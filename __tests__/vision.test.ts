import { VisionPerception } from '../src/agent/perception/visionPerception';
import { NvidiaVisionProvider } from '../src/agent/providers/nvidiaVisionProvider';
import { ToolRegistry } from '../src/tools/registry';
import { ContextManager } from '../src/agent/context';
import { VisionFallbackManager } from '../src/agent/visionFallback';
import { AccessibilityModule } from '../src/native/AccessibilityModule';
import { ScreenCaptureModule } from '../src/native/ScreenCaptureModule';
import { RootControlModule } from '../src/native/RootControlModule';
import { useSettingsStore } from '../src/state/settingsStore';
import { ScreenTree } from '../src/native/types';
import { ModelMessage } from '../src/agent/providers/types';
import { TaskState } from '../src/agent/task/types';
import { TaskManager } from '../src/agent/task/taskManager';

describe('PHASE 5: Vision Perception & Screen Grounding (ADR-006, ADR-011, ADR-013)', () => {
  beforeAll(() => {
    ToolRegistry.initialize();
  });

  beforeEach(() => {
    VisionPerception.resetMockState();
    RootControlModule.resetMockState();
    AccessibilityModule.resetMockTree();
    useSettingsStore.getState().setSettings({
      visionFallbackEnabled: true,
      defaultModelProvider: 'nvidia',
      nvidiaVisionModel: 'meta/llama-3.2-11b-vision-instruct',
    });
  });

  afterEach(() => {
    VisionPerception.resetMockState();
    RootControlModule.resetMockState();
  });

  describe('1. Tree Sparsity & Flutter/Canvas Detection', () => {
    test('identifies empty or null tree as sparse', () => {
      const emptyTree: ScreenTree = {
        activePackage: 'com.game.sample',
        nodes: [],
        timestamp: Date.now(),
        screenWidth: 1080,
        screenHeight: 2400,
      };
      expect(VisionPerception.isTreeSparse(emptyTree)).toBe(true);
      expect(VisionPerception.informativeNodeCount(emptyTree)).toBe(0);
    });

    test('identifies tree with unknown package as sparse', () => {
      const unknownTree: ScreenTree = {
        activePackage: 'unknown',
        nodes: [
          {
            id: 'node1',
            className: 'android.view.View',
            text: 'Hello',
            bounds: { left: 0, top: 0, right: 100, bottom: 100, centerX: 50, centerY: 50, width: 100, height: 100 },
            isClickable: true,
            isEditable: false,
            isScrollable: false,
            isVisible: true,
            packageName: 'unknown',
          },
        ],
        timestamp: Date.now(),
        screenWidth: 1080,
        screenHeight: 2400,
      };
      expect(VisionPerception.isTreeSparse(unknownTree)).toBe(true);
    });

    test('identifies Flutter / Unity / Canvas surface view with zero interactive children as sparse', () => {
      const flutterTree: ScreenTree = {
        activePackage: 'com.flutter.app',
        nodes: [
          {
            id: 'flutter_surface',
            className: 'io.flutter.embedding.android.FlutterView',
            text: '',
            contentDescription: '',
            bounds: { left: 0, top: 0, right: 1080, bottom: 2400, centerX: 540, centerY: 1200, width: 1080, height: 2400 },
            isClickable: false,
            isEditable: false,
            isScrollable: false,
            isVisible: true,
            packageName: 'com.flutter.app',
          },
        ],
        timestamp: Date.now(),
        screenWidth: 1080,
        screenHeight: 2400,
      };
      expect(VisionPerception.isFlutterOrCanvas(flutterTree)).toBe(true);
      expect(VisionPerception.isTreeSparse(flutterTree)).toBe(true);
    });

    test('identifies rich native accessibility tree as NOT sparse', () => {
      const richTree: ScreenTree = {
        activePackage: 'com.google.android.youtube',
        nodes: [
          {
            id: 'search_btn',
            className: 'android.widget.ImageView',
            text: '',
            contentDescription: 'Search',
            bounds: { left: 900, top: 100, right: 1020, bottom: 220, centerX: 960, centerY: 160, width: 120, height: 120 },
            isClickable: true,
            isEditable: false,
            isScrollable: false,
            isVisible: true,
            packageName: 'com.google.android.youtube',
          },
          {
            id: 'video_card',
            className: 'android.view.ViewGroup',
            text: 'Marvel Studios Avengers Trailer',
            contentDescription: '100M views',
            bounds: { left: 0, top: 300, right: 1080, bottom: 900, centerX: 540, centerY: 600, width: 1080, height: 600 },
            isClickable: true,
            isEditable: false,
            isScrollable: false,
            isVisible: true,
            packageName: 'com.google.android.youtube',
          },
        ],
        timestamp: Date.now(),
        screenWidth: 1080,
        screenHeight: 2400,
      };
      expect(VisionPerception.informativeNodeCount(richTree)).toBe(2);
      expect(VisionPerception.isTreeSparse(richTree)).toBe(false);
      expect(VisionPerception.shouldTriggerVisionFallback(richTree)).toBe(false);
    });

    test('shouldTriggerVisionFallback respects visionFallbackEnabled setting', () => {
      const sparseTree: ScreenTree = {
        activePackage: 'com.game.unity',
        nodes: [],
        timestamp: Date.now(),
        screenWidth: 1080,
        screenHeight: 2400,
      };

      useSettingsStore.getState().setSettings({ visionFallbackEnabled: true });
      expect(VisionPerception.shouldTriggerVisionFallback(sparseTree)).toBe(true);

      useSettingsStore.getState().setSettings({ visionFallbackEnabled: false });
      expect(VisionPerception.shouldTriggerVisionFallback(sparseTree)).toBe(false);
    });
  });

  describe('2. Coordinate Grounding & Bounding Box Scaling Math', () => {
    test('scales 0..1000 normalized bounding box to 1080x2400 physical pixels', () => {
      // Box: ymin=100 (top 10%), xmin=200 (left 20%), ymax=300 (bottom 30%), xmax=800 (right 80%)
      const box: [number, number, number, number] = [100, 200, 300, 800];
      const scaled = NvidiaVisionProvider.scaleBoundingBox(box, 1080, 2400);

      expect(scaled.left).toBe(Math.round(0.2 * 1080)); // 216
      expect(scaled.top).toBe(Math.round(0.1 * 2400)); // 240
      expect(scaled.right).toBe(Math.round(0.8 * 1080)); // 864
      expect(scaled.bottom).toBe(Math.round(0.3 * 2400)); // 720
      expect(scaled.centerX).toBe(Math.round(scaled.left + scaled.width / 2)); // 540
      expect(scaled.centerY).toBe(Math.round(scaled.top + scaled.height / 2)); // 480
    });

    test('scales 0..1 normalized bounding box accurately', () => {
      const box = { ymin: 0.1, xmin: 0.2, ymax: 0.5, xmax: 0.6 };
      const scaled = NvidiaVisionProvider.scaleBoundingBox(box, 1000, 2000);

      expect(scaled.left).toBe(200);
      expect(scaled.top).toBe(200);
      expect(scaled.right).toBe(600);
      expect(scaled.bottom).toBe(1000);
      expect(scaled.centerX).toBe(400);
      expect(scaled.centerY).toBe(600);
    });

    test('VisionPerception.groundCoordinates handles point and box formats', () => {
      // Point normalized 0..1000
      const point = VisionPerception.groundCoordinates({ x: 500, y: 250 }, 1080, 2400);
      expect(point.x).toBe(540);
      expect(point.y).toBe(600);

      // Bounding box
      const boxPoint = VisionPerception.groundCoordinates(
        { xmin: 100, ymin: 100, xmax: 300, ymax: 300 },
        1000,
        2000
      );
      expect(boxPoint.x).toBe(200);
      expect(boxPoint.y).toBe(400);
    });
  });

  describe('3. NvidiaVisionProvider Response Parsing', () => {
    test('parses JSON with box_2d format', () => {
      const rawJson = JSON.stringify({
        found: true,
        label: 'search button',
        box_2d: [100, 200, 300, 400],
        confidence: 0.98,
      });

      const parsed = NvidiaVisionProvider.parseGroundingResponse(rawJson, 'search button', 1080, 2400);
      expect(parsed.found).toBe(true);
      expect(parsed.confidence).toBe(0.98);
      expect(parsed.x).toBe(324); // (200+400)/2 / 1000 * 1080 = 324
      expect(parsed.y).toBe(480); // (100+300)/2 / 1000 * 2400 = 480
    });

    test('parses JSON within markdown code blocks', () => {
      const mdContent = `Here is the detected element:\n\`\`\`json\n{\n  "point": [500, 500],\n  "label": "play button"\n}\n\`\`\``;

      const parsed = NvidiaVisionProvider.parseGroundingResponse(mdContent, 'play button', 1080, 2400);
      expect(parsed.found).toBe(true);
      expect(parsed.x).toBe(540);
      expect(parsed.y).toBe(1200);
    });

    test('parses elements array finding target query', () => {
      const raw = JSON.stringify({
        elements: [
          { label: 'Back button', box2d: [50, 50, 100, 100] },
          { label: 'Skip Ad button', box2d: [800, 700, 900, 950] },
        ],
      });

      const parsed = NvidiaVisionProvider.parseGroundingResponse(raw, 'skip ad', 1080, 2400);
      expect(parsed.found).toBe(true);
      expect(parsed.elementLabel).toBe('Skip Ad button');
      // x: (700+950)/2 / 1000 * 1080 = 891
      expect(parsed.x).toBe(891);
      // y: (800+900)/2 / 1000 * 2400 = 2040
      expect(parsed.y).toBe(2040);
    });

    test('falls back gracefully to regex coordinates when JSON is malformed', () => {
      const freeText = 'I found the search icon at [100, 200, 200, 400] on the screen.';
      const parsed = NvidiaVisionProvider.parseGroundingResponse(freeText, 'search icon', 1080, 2400);
      expect(parsed.found).toBe(true);
      expect(parsed.x).toBe(324);
      expect(parsed.y).toBe(360);
    });
  });

  describe('4. ToolRegistry Vision Tools Execution', () => {
    test('registers capture_screen_vision and visual_tap tools in registry', () => {
      const allTools = ToolRegistry.getAllTools().map((t) => t.name);
      expect(allTools).toContain('capture_screen_vision');
      expect(allTools).toContain('visual_tap');
    });

    test('executes capture_screen_vision tool successfully', async () => {
      VisionPerception.setMockScreenAnalysis({
        description: 'Mock YouTube Canvas Player screen with play and pause controls',
        activeAppHint: 'com.google.android.youtube',
        elements: [
          { label: 'Play', type: 'button', box2d: [400, 400, 600, 600], confidence: 0.95 },
          { label: 'Fullscreen', type: 'button', box2d: [850, 850, 950, 950], confidence: 0.9 },
        ],
      });

      const result = await ToolRegistry.executeTool('capture_screen_vision', { prompt: 'Extract player controls' });
      expect(result.success).toBe(true);
      expect(result.data.elementCount).toBe(2);
      expect(result.data.activeAppHint).toBe('com.google.android.youtube');
    });

    test('executes visual_tap tool using Accessibility gesture by default', async () => {
      VisionPerception.setMockGrounding('search icon', { x: 960, y: 160, confidence: 0.96 });

      const result = await ToolRegistry.executeTool('visual_tap', { query: 'search icon' });
      expect(result.success).toBe(true);
      expect(result.data.x).toBe(960);
      expect(result.data.y).toBe(160);
      expect(result.data.method).toBe('accessibility');
    });

    test('executes visual_tap tool with preferElevated invoking RootControlModule', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });
      VisionPerception.setMockGrounding('target menu', { x: 500, y: 1000, confidence: 0.92 });

      const result = await ToolRegistry.executeTool('visual_tap', {
        query: 'target menu',
        preferElevated: true,
      });

      expect(result.success).toBe(true);
      expect(result.data.x).toBe(500);
      expect(result.data.y).toBe(1000);
      expect(result.data.method).toBe('elevated');
      expect(RootControlModule.getExecutedCommands()).toContain('input tap 500 1000');
    });

    test('returns error when query is empty for visual_tap', async () => {
      const result = await ToolRegistry.executeTool('visual_tap', { query: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });
  });

  describe('5. Fallback from Accessibility Click to Elevated Tap', () => {
    test('falls back to elevated tap when accessibility click fails', async () => {
      RootControlModule.setMockStatus({
        shizukuAvailable: true,
        shizukuPermission: true,
      });

      // Mock accessibility click to fail
      const originalClick = AccessibilityModule.clickCoordinates;
      AccessibilityModule.clickCoordinates = jest.fn().mockResolvedValue(false);

      VisionPerception.setMockGrounding('protected button', { x: 400, y: 800, confidence: 0.9 });

      const tapResult = await VisionPerception.executeVisualTap('protected button', false);
      expect(tapResult.success).toBe(true);
      expect(tapResult.method).toBe('elevated');
      expect(RootControlModule.getExecutedCommands()).toContain('input tap 400 800');

      // Restore
      AccessibilityModule.clickCoordinates = originalClick;
    });
  });

  describe('6. Vision Fallback Manager & ContextManager Integration', () => {
    test('VisionFallbackManager executes visual action end-to-end', async () => {
      VisionPerception.setMockGrounding('close dialog', { x: 540, y: 1800 });

      const ok = await VisionFallbackManager.executeVisualAction('close dialog');
      expect(ok).toBe(true);
    });

    test('ContextManager attaches visualContext when screen tree is sparse', async () => {
      // Set empty tree
      AccessibilityModule.setMockPackage('com.unknown.canvas');

      const task = TaskManager.createTask('play game');
      task.status = 'EXECUTING';

      const context = await ContextManager.assembleContext(task);
      expect(context.visualContext).toBeDefined();
      expect(context.visualContext?.isSparse).toBe(true);
    });

    test('VisionPerception.augment attaches screenshot to messages when tree is sparse', async () => {
      const messages: ModelMessage[] = [
        { role: 'system', content: 'You are FRIDAY.' },
        { role: 'user', content: 'Tap the start button.' },
      ];

      const snapshot = await ContextManager.assembleContext(TaskManager.createTask('tap start button'));

      const augmented = await VisionPerception.augment(messages, snapshot);
      expect(augmented.length).toBe(2);
      const lastUser = augmented[1];
      expect(Array.isArray(lastUser.content)).toBe(true);

      const parts = lastUser.content as any[];
      const imagePart = parts.find((p) => p.type === 'image_url');
      expect(imagePart).toBeDefined();
      expect(imagePart.image_url.url).toContain('data:image/jpeg;base64,');
    });

    test('VisionPerception.augment leaves messages unchanged when tree is rich', async () => {
      AccessibilityModule.setMockPackage('com.google.android.youtube');

      const messages: ModelMessage[] = [
        { role: 'system', content: 'You are FRIDAY.' },
        { role: 'user', content: 'Play first video.' },
      ];

      const snapshot = await ContextManager.assembleContext(TaskManager.createTask('play first video'));

      const augmented = await VisionPerception.augment(messages, snapshot);
      expect(augmented).toEqual(messages);
    });
  });

  describe('7. Edge Cases & Robustness Audit Tests', () => {
    test('scaleBoundingBox handles physical pixels (> 1000) without double scaling', () => {
      const physicalBox: [number, number, number, number] = [100, 200, 1500, 900];
      const scaled = NvidiaVisionProvider.scaleBoundingBox(physicalBox, 1080, 2400);

      expect(scaled.left).toBe(200);
      expect(scaled.top).toBe(100);
      expect(scaled.right).toBe(900);
      expect(scaled.bottom).toBe(1500);
      expect(scaled.centerX).toBe(550);
      expect(scaled.centerY).toBe(800);
    });

    test('scaleBoundingBox handles inverted bounds (ymin > ymax)', () => {
      const invertedBox: [number, number, number, number] = [800, 900, 200, 100];
      const scaled = NvidiaVisionProvider.scaleBoundingBox(invertedBox, 1000, 2000);

      expect(scaled.top).toBe(400); // 200/1000 * 2000
      expect(scaled.bottom).toBe(1600); // 800/1000 * 2000
      expect(scaled.left).toBe(100); // 100/1000 * 1000
      expect(scaled.right).toBe(900); // 900/1000 * 1000
    });

    test('scaleBoundingBox safely falls back when screen dimensions are 0 or NaN', () => {
      const box = [100, 100, 500, 500] as [number, number, number, number];
      const scaled = NvidiaVisionProvider.scaleBoundingBox(box, 0, NaN);

      expect(scaled.left).toBe(Math.round((100 / 1000) * 1080));
      expect(scaled.top).toBe(Math.round((100 / 1000) * 2400));
    });

    test('groundCoordinates handles physical pixels, normalized points, and boxes', () => {
      // Physical pixels
      const physical = VisionPerception.groundCoordinates({ x: 1050, y: 2200 }, 1080, 2400);
      expect(physical.x).toBe(1050);
      expect(physical.y).toBe(2200);

      // 0..1 scale point
      const zeroToOne = VisionPerception.groundCoordinates({ x: 0.5, y: 0.25 }, 1000, 2000);
      expect(zeroToOne.x).toBe(500);
      expect(zeroToOne.y).toBe(500);

      // Null argument
      const nullFallback = VisionPerception.groundCoordinates(null as any, 1080, 2400);
      expect(nullFallback.x).toBe(540);
      expect(nullFallback.y).toBe(1200);
    });

    test('parseGroundingResponse avoids false positive point matches on arbitrary numbered text', () => {
      const falseText = 'In step 1, 2 items were detected on screen.';
      const parsed = NvidiaVisionProvider.parseGroundingResponse(falseText, 'target button', 1080, 2400);
      // Should NOT match "1, 2" as a tap coordinate
      expect(parsed.found).toBe(false);
      expect(parsed.x).toBe(540);
      expect(parsed.y).toBe(1200);
    });

    test('parseGroundingResponse accurately parses explicit coordinate formats', () => {
      // Format: point: (540, 1200)
      const res1 = NvidiaVisionProvider.parseGroundingResponse('The element is at point: (500, 500)', 'btn', 1000, 2000);
      expect(res1.found).toBe(true);
      expect(res1.x).toBe(500);
      expect(res1.y).toBe(1000);

      // Format: coordinates: [200, 400]
      const res2 = NvidiaVisionProvider.parseGroundingResponse('coordinates: [200, 400]', 'btn', 1000, 2000);
      expect(res2.found).toBe(true);
      expect(res2.x).toBe(200);
      expect(res2.y).toBe(800);

      // Format: x=300, y=600
      const res3 = NvidiaVisionProvider.parseGroundingResponse('Found at x: 300, y: 600', 'btn', 1000, 2000);
      expect(res3.found).toBe(true);
      expect(res3.x).toBe(300);
      expect(res3.y).toBe(1200);
    });

    test('parseGroundingResponse honors explicit found: false in JSON', () => {
      const notFoundJson = JSON.stringify({ found: false, message: 'Element not visible' });
      const parsed = NvidiaVisionProvider.parseGroundingResponse(notFoundJson, 'missing btn', 1080, 2400);
      expect(parsed.found).toBe(false);
      expect(parsed.confidence).toBe(0.0);
    });

    test('captureScreen sanitizes base64 data URL prefixes and whitespace', async () => {
      const captureSpy = jest.spyOn(ScreenCaptureModule, 'captureScreenshot').mockResolvedValueOnce({
        base64: '   data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=   ',
        width: 720,
        height: 1600,
      });

      const capture = await VisionPerception.captureScreen();
      expect(capture.base64).not.toContain('data:image');
      expect(capture.base64).not.toMatch(/^\s+/);
      expect(capture.base64).toMatch(/^iVBORw0/);

      captureSpy.mockRestore();
    });

    test('VisionFallbackManager handles empty goal gracefully', async () => {
      const ok = await VisionFallbackManager.executeVisualAction('');
      expect(ok).toBe(false);
    });

    test('capture_screen_vision handles undefined parameters without throwing', async () => {
      VisionPerception.setMockScreenAnalysis({
        description: 'Mock screen',
        elements: [],
      });
      const result = await ToolRegistry.executeTool('capture_screen_vision', undefined as any);
      expect(result.success).toBe(true);
      expect(result.data.description).toBe('Mock screen');
    });
  });
});
