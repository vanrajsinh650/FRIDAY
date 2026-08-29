import { ModelMessage, MessageContentPart, extractText, toImageDataUrl } from '../providers/types';
import { AgentContextSnapshot } from '../types';
import { ScreenTree, UINode } from '../../native/types';
import { AccessibilityModule } from '../../native/AccessibilityModule';
import { ScreenCaptureModule } from '../../native/ScreenCaptureModule';
import { RootControlModule } from '../../native/RootControlModule';
import { NvidiaVisionProvider, VisualGroundingResult, VisionAnalysisResult, VisualElement } from '../providers/nvidiaVisionProvider';
import { useSettingsStore } from '../../state/settingsStore';
import { Logger } from '../../utils/logger';

// On-demand visual perception & screen grounding (ADR-006, ADR-011, ADR-013).
//
// The accessibility tree is the primary, cheapest way to "see" the screen — it
// hands us text, editable fields, content descriptions and clickable bounds for
// free. Vision (a screenshot through a VLM) is strictly a fallback for the case
// the tree cannot cover: Canvas/WebView surfaces, Flutter apps, games, maps,
// or a momentarily unreadable window that returns almost no nodes. We escalate to
// a screenshot only then, and only when the user has vision fallback enabled —
// never every frame.
export class VisionPerception {
  private static visionProvider = new NvidiaVisionProvider();
  private static mockGroundings: Map<string, { x: number; y: number; confidence?: number }> = new Map();
  private static mockScreenAnalysis: VisionAnalysisResult | null = null;

  static setMockGrounding(query: string, result: { x: number; y: number; confidence?: number }): void {
    this.mockGroundings.set(query.toLowerCase().trim(), result);
  }

  static setMockScreenAnalysis(analysis: VisionAnalysisResult | null): void {
    this.mockScreenAnalysis = analysis;
  }

  static resetMockState(): void {
    this.mockGroundings.clear();
    this.mockScreenAnalysis = null;
    NvidiaVisionProvider.resetMockHandler();
  }

  // How many nodes actually carry human-meaningful content (text or a content
  // description). Pure layout/group nodes don't help a reasoner.
  static informativeNodeCount(tree: ScreenTree): number {
    if (!tree || !tree.nodes) return 0;
    return tree.nodes.filter(
      (n) => (n.text && n.text.trim().length > 0) || (n.contentDescription && n.contentDescription.trim().length > 0)
    ).length;
  }

  // Detects if the current screen tree corresponds to a Canvas, Flutter, WebView,
  // or Game surface view that lacks standard accessibility nodes.
  static isFlutterOrCanvas(tree: ScreenTree): boolean {
    if (!tree || !tree.nodes || tree.nodes.length === 0) return false;
    const canvasClasses = [
      'surfaceview',
      'glsurfaceview',
      'textureview',
      'flutterview',
      'flutter',
      'unityplayeractivity',
      'unity',
      'gameactivity',
      'gameview',
      'godot',
      'webview',
      'renderwidgethostview',
      'crosswalk',
      'canvas',
    ];

    const hasCanvasNode = tree.nodes.some((n) => {
      const cls = (n.className || '').toLowerCase();
      return canvasClasses.some((c) => cls.includes(c));
    });

    const interactiveCount = tree.nodes.filter((n) => n.isClickable || n.isEditable).length;
    const informativeCount = this.informativeNodeCount(tree);
    return hasCanvasNode && (interactiveCount <= 1 || informativeCount <= 1);
  }

  // The tree is "sparse" or "unreadable" when the window is unknown, contains
  // almost no meaningful nodes, or is an opaque Flutter/Canvas/Game surface.
  static isTreeSparse(tree: ScreenTree): boolean {
    if (!tree || !tree.nodes || tree.nodes.length === 0) return true;
    if (tree.activePackage === 'unknown') return true;
    if (this.isFlutterOrCanvas(tree)) return true;
    return this.informativeNodeCount(tree) <= 1;
  }

  // Determines whether vision fallback should trigger for the given tree state.
  static shouldTriggerVisionFallback(tree: ScreenTree): boolean {
    const settings = useSettingsStore.getState();
    if (!settings.visionFallbackEnabled) return false;
    return this.isTreeSparse(tree);
  }

  /**
   * Captures screen using MediaProjection bridge (ScreenCaptureModule) or AccessibilityModule fallback.
   */
  static async captureScreen(): Promise<{ base64: string; width: number; height: number }> {
    const sanitizeBase64 = (raw: string): string => {
      return (raw || '').trim().replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    };

    try {
      const capture = await ScreenCaptureModule.captureScreenshot({ quality: 75, maxWidth: 720 });
      if (capture && capture.base64) {
        const cleanBase64 = sanitizeBase64(capture.base64);
        if (cleanBase64.length > 10 && cleanBase64 !== 'null' && cleanBase64 !== 'undefined') {
          return {
            base64: cleanBase64,
            width: capture.width > 0 ? capture.width : 720,
            height: capture.height > 0 ? capture.height : 1600,
          };
        }
      }
    } catch (err: any) {
      Logger.warn('VisionPerception: ScreenCaptureModule threw, attempting Accessibility capture fallback', err?.message || err);
    }

    try {
      const rawBase64 = await AccessibilityModule.captureScreenBase64();
      if (rawBase64) {
        const cleanBase64 = sanitizeBase64(rawBase64);
        if (cleanBase64.length > 10 && cleanBase64 !== 'null' && cleanBase64 !== 'undefined') {
          return {
            base64: cleanBase64,
            width: 720,
            height: 1600,
          };
        }
      }
    } catch (err: any) {
      Logger.warn('VisionPerception: AccessibilityModule.captureScreenBase64 threw', err?.message || err);
    }

    return {
      base64: '',
      width: 720,
      height: 1600,
    };
  }

  /**
   * Ground a normalized bounding box or coordinate point to physical screen coordinates.
   */
  static groundCoordinates(
    boxOrPoint: { xmin?: number; ymin?: number; xmax?: number; ymax?: number; x?: number; y?: number },
    screenWidth: number = 1080,
    screenHeight: number = 2400
  ): { x: number; y: number } {
    const safeW = screenWidth > 0 && !isNaN(screenWidth) ? screenWidth : 1080;
    const safeH = screenHeight > 0 && !isNaN(screenHeight) ? screenHeight : 2400;

    if (!boxOrPoint) {
      return { x: Math.round(safeW * 0.5), y: Math.round(safeH * 0.5) };
    }

    if (typeof boxOrPoint.x === 'number' && typeof boxOrPoint.y === 'number') {
      const rawX = boxOrPoint.x;
      const rawY = boxOrPoint.y;
      const isPhysical = rawX > 1000 || rawY > 1000;
      let px: number, py: number;

      if (isPhysical) {
        px = Math.round(rawX);
        py = Math.round(rawY);
      } else if (rawX <= 1.0 && rawY <= 1.0 && (rawX > 0 || rawY > 0)) {
        px = Math.round(rawX * safeW);
        py = Math.round(rawY * safeH);
      } else {
        px = Math.round((rawX / 1000.0) * safeW);
        py = Math.round((rawY / 1000.0) * safeH);
      }

      return {
        x: Math.max(0, Math.min(safeW, px)),
        y: Math.max(0, Math.min(safeH, py)),
      };
    }

    const ymin = boxOrPoint.ymin ?? 0;
    const xmin = boxOrPoint.xmin ?? 0;
    const ymax = boxOrPoint.ymax ?? 1000;
    const xmax = boxOrPoint.xmax ?? 1000;

    const scaled = NvidiaVisionProvider.scaleBoundingBox([ymin, xmin, ymax, xmax], safeW, safeH);
    return { x: scaled.centerX, y: scaled.centerY };
  }

  /**
   * Analyze screen with Vision Language Model (VLM), extracting visible text and bounding boxes.
   */
  static async analyzeScreen(customPrompt?: string): Promise<VisionAnalysisResult> {
    if (this.mockScreenAnalysis) {
      return this.mockScreenAnalysis;
    }

    const capture = await this.captureScreen();
    if (!capture.base64) {
      return {
        description: 'Unable to capture screen for visual analysis.',
        elements: [],
      };
    }

    return await this.visionProvider.analyzeImage(capture.base64, customPrompt);
  }

  /**
   * Grounds a target visual query (e.g. "search button", "skip ad", "avatar") to pixel coordinates on the active screen.
   */
  static async groundVisualElement(
    targetQuery: string,
    screenWidth: number = 1080,
    screenHeight: number = 2400
  ): Promise<VisualGroundingResult> {
    const safeW = screenWidth > 0 && !isNaN(screenWidth) ? screenWidth : 1080;
    const safeH = screenHeight > 0 && !isNaN(screenHeight) ? screenHeight : 2400;
    const cleanQuery = (targetQuery || '').toLowerCase().trim();

    if (this.mockGroundings.has(cleanQuery)) {
      const mock = this.mockGroundings.get(cleanQuery)!;
      return {
        found: true,
        x: mock.x,
        y: mock.y,
        normalizedX: Math.max(0, Math.min(1, mock.x / safeW)),
        normalizedY: Math.max(0, Math.min(1, mock.y / safeH)),
        confidence: mock.confidence ?? 0.95,
        elementLabel: targetQuery,
      };
    }

    const capture = await this.captureScreen();
    if (!capture.base64) {
      return {
        found: false,
        x: Math.round(safeW * 0.5),
        y: Math.round(safeH * 0.5),
        normalizedX: 0.5,
        normalizedY: 0.5,
        confidence: 0.0,
        elementLabel: targetQuery,
      };
    }

    return await this.visionProvider.groundVisualElement(
      capture.base64,
      targetQuery,
      capture.width || safeW,
      capture.height || safeH
    );
  }

  /**
   * Computes coordinate from visual query and executes touch tap via Accessibility or Elevated tap.
   */
  static async executeVisualTap(
    targetQuery: string,
    preferElevated: boolean = false
  ): Promise<{ success: boolean; x: number; y: number; confidence: number; method: 'accessibility' | 'elevated' }> {
    if (!targetQuery || typeof targetQuery !== 'string' || targetQuery.trim().length === 0) {
      Logger.warn('VisionPerception: executeVisualTap received empty query');
      return { success: false, x: 0, y: 0, confidence: 0, method: preferElevated ? 'elevated' : 'accessibility' };
    }

    Logger.info(`VisionPerception: Executing visual tap for query "${targetQuery}" (preferElevated: ${preferElevated})`);

    let screenWidth = 1080;
    let screenHeight = 2400;
    try {
      const tree = await AccessibilityModule.inspectScreen();
      if (tree && tree.screenWidth > 0) screenWidth = tree.screenWidth;
      if (tree && tree.screenHeight > 0) screenHeight = tree.screenHeight;
    } catch (_e) {
      // Use defaults
    }

    const grounding = await this.groundVisualElement(targetQuery.trim(), screenWidth, screenHeight);
    const targetX = grounding.x;
    const targetY = grounding.y;

    if (!grounding.found && grounding.confidence === 0) {
      Logger.warn(`VisionPerception: Target element "${targetQuery}" not found on screen`);
    }

    if (preferElevated) {
      const elevatedOk = await RootControlModule.inputTap(targetX, targetY);
      if (elevatedOk) {
        return { success: true, x: targetX, y: targetY, confidence: grounding.confidence, method: 'elevated' };
      }
    }

    // Attempt standard Accessibility gesture click
    const a11yOk = await AccessibilityModule.clickCoordinates(targetX, targetY);
    if (a11yOk) {
      return { success: true, x: targetX, y: targetY, confidence: grounding.confidence, method: 'accessibility' };
    }

    // Fallback: If Accessibility click fails, try Elevated tap
    const elevatedFallbackOk = await RootControlModule.inputTap(targetX, targetY);
    return {
      success: elevatedFallbackOk,
      x: targetX,
      y: targetY,
      confidence: grounding.confidence,
      method: elevatedFallbackOk ? 'elevated' : 'accessibility',
    };
  }

  static async augment(messages: ModelMessage[], snapshot: AgentContextSnapshot): Promise<ModelMessage[]> {
    const isSparse = this.isTreeSparse(snapshot.screenTree);
    if (!isSparse) {
      return messages;
    }

    let base64 = '';
    try {
      const capture = await this.captureScreen();
      base64 = capture.base64;
    } catch (err: any) {
      Logger.warn('VisionPerception: screenshot capture threw', err?.message || err);
    }

    if (!base64) return messages;

    Logger.info('VisionPerception: Attaching live screen visual grounding to reasoning prompt');
    return this.attachImageToLastUser(messages, base64);
  }

  // Fold the screenshot into the last user turn as OpenAI-style content parts,
  // preserving the existing text and adding the vision context.
  private static attachImageToLastUser(messages: ModelMessage[], base64Jpeg: string): ModelMessage[] {
    const out = [...messages];
    let idx = -1;
    for (let i = out.length - 1; i >= 0; i--) {
      if (out[i].role === 'user') {
        idx = i;
        break;
      }
    }
    if (idx === -1) return messages;

    const existingText = extractText(out[idx].content);
    const parts: MessageContentPart[] = [
      {
        type: 'text',
        text:
          `${existingText}\n\n[LIVE SCREEN VISION] Here is the real-time visual capture of the active screen. ` +
          `Use both the visible text and the visual screenshot to determine the exact action to execute.`,
      },
      { type: 'image_url', image_url: { url: toImageDataUrl(base64Jpeg), detail: 'high' } },
    ];
    out[idx] = { ...out[idx], content: parts };
    return out;
  }
}
