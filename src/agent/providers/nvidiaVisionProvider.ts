import { ModelMessage, ModelProvider, ToolCallResult, hasImageContent, extractText, toImageDataUrl } from './types';
import { useSettingsStore } from '../../state/settingsStore';
import { getSecret } from '../../config/secrets';
import { Logger } from '../../utils/logger';
import { fetchWithTimeout, TEXT_REQUEST_TIMEOUT_MS, VISION_REQUEST_TIMEOUT_MS } from './httpClient';

export interface VisualBoundingBox {
  ymin: number; // 0..1000 or 0..1
  xmin: number;
  ymax: number;
  xmax: number;
}

export interface VisualElement {
  label: string;
  type?: 'button' | 'text' | 'input' | 'icon' | 'image' | 'card' | 'unknown';
  box2d?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] (0..1000)
  bounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  confidence?: number;
  description?: string;
}

export interface VisionAnalysisResult {
  description: string;
  elements: VisualElement[];
  activeAppHint?: string;
  rawText?: string;
  suggestedAction?: string;
}

export interface VisualGroundingResult {
  found: boolean;
  x: number; // Physical device X
  y: number; // Physical device Y
  normalizedX: number; // 0..1
  normalizedY: number; // 0..1
  confidence: number;
  elementLabel?: string;
  box2d?: [number, number, number, number];
  rawResponse?: string;
}

function toTuple4(arr: any): [number, number, number, number] | undefined {
  if (Array.isArray(arr) && arr.length >= 4) {
    return [Number(arr[0]), Number(arr[1]), Number(arr[2]), Number(arr[3])];
  }
  if (arr && typeof arr === 'object' && 'ymin' in arr && 'xmin' in arr && 'ymax' in arr && 'xmax' in arr) {
    return [Number(arr.ymin), Number(arr.xmin), Number(arr.ymax), Number(arr.xmax)];
  }
  return undefined;
}

type VisionMockHandler = (base64Image: string, prompt: string) => Promise<string | VisionAnalysisResult | VisualGroundingResult | null>;

export class NvidiaVisionProvider implements ModelProvider {
  name = 'nvidia-vision';
  supportsVision = true;
  private baseUrl = 'https://integrate.api.nvidia.com/v1/chat/completions';
  private defaultVisionModel = 'meta/llama-3.2-11b-vision-instruct';

  private static mockHandler: VisionMockHandler | null = null;

  static setMockHandler(handler: VisionMockHandler | null): void {
    this.mockHandler = handler;
  }

  static resetMockHandler(): void {
    this.mockHandler = null;
  }

  private getApiKey(): string {
    return useSettingsStore.getState().nvidiaApiKey || getSecret('NVIDIA_API_KEY');
  }

  private getVisionModel(): string {
    return useSettingsStore.getState().nvidiaVisionModel || this.defaultVisionModel;
  }

  private getModelFor(messages: ModelMessage[]): string {
    if (hasImageContent(messages)) {
      return this.getVisionModel();
    }
    return useSettingsStore.getState().nvidiaModel || 'meta/llama-3.1-8b-instruct';
  }

  /**
   * Scale normalized bounding box (0..1000 or 0..1) or physical pixels to device coordinates.
   */
  static scaleBoundingBox(
    box: [number, number, number, number] | VisualBoundingBox,
    screenWidth: number = 1080,
    screenHeight: number = 2400
  ): { left: number; top: number; right: number; bottom: number; centerX: number; centerY: number; width: number; height: number } {
    const safeW = screenWidth > 0 && !isNaN(screenWidth) ? screenWidth : 1080;
    const safeH = screenHeight > 0 && !isNaN(screenHeight) ? screenHeight : 2400;

    let rawYmin: number, rawXmin: number, rawYmax: number, rawXmax: number;
    if (Array.isArray(box)) {
      rawYmin = Number(box[0]) || 0;
      rawXmin = Number(box[1]) || 0;
      rawYmax = Number(box[2]) || 0;
      rawXmax = Number(box[3]) || 0;
    } else if (box && typeof box === 'object') {
      rawYmin = Number(box.ymin) || 0;
      rawXmin = Number(box.xmin) || 0;
      rawYmax = Number(box.ymax) || 0;
      rawXmax = Number(box.xmax) || 0;
    } else {
      rawYmin = 0;
      rawXmin = 0;
      rawYmax = 1000;
      rawXmax = 1000;
    }

    const ymin = Math.min(rawYmin, rawYmax);
    const ymax = Math.max(rawYmin, rawYmax);
    const xmin = Math.min(rawXmin, rawXmax);
    const xmax = Math.max(rawXmin, rawXmax);

    // Determine coordinate scale: 0..1, physical pixels (>1000), or 0..1000 normalized
    const isZeroToOne = ymax <= 1.0 && xmax <= 1.0 && (ymin > 0 || xmin > 0 || ymax > 0 || xmax > 0);
    const isPhysicalPixels = ymax > 1000 || xmax > 1000;

    let left: number, top: number, right: number, bottom: number;
    if (isPhysicalPixels) {
      left = Math.round(xmin);
      top = Math.round(ymin);
      right = Math.round(xmax);
      bottom = Math.round(ymax);
    } else if (isZeroToOne) {
      left = Math.round(xmin * safeW);
      top = Math.round(ymin * safeH);
      right = Math.round(xmax * safeW);
      bottom = Math.round(ymax * safeH);
    } else {
      left = Math.round((xmin / 1000.0) * safeW);
      top = Math.round((ymin / 1000.0) * safeH);
      right = Math.round((xmax / 1000.0) * safeW);
      bottom = Math.round((ymax / 1000.0) * safeH);
    }

    left = Math.max(0, Math.min(safeW, left));
    top = Math.max(0, Math.min(safeH, top));
    right = Math.max(0, Math.min(safeW, right));
    bottom = Math.max(0, Math.min(safeH, bottom));

    const width = Math.max(1, right - left);
    const height = Math.max(1, bottom - top);
    const centerX = Math.max(0, Math.min(safeW, Math.round(left + width / 2)));
    const centerY = Math.max(0, Math.min(safeH, Math.round(top + height / 2)));

    return { left, top, right, bottom, centerX, centerY, width, height };
  }

  /**
   * Parse coordinates from various model response formats (JSON, markdown fences, points, bounding boxes).
   */
  static parseGroundingResponse(
    responseContent: string,
    targetQuery: string,
    screenWidth: number = 1080,
    screenHeight: number = 2400
  ): VisualGroundingResult {
    const safeW = screenWidth > 0 && !isNaN(screenWidth) ? screenWidth : 1080;
    const safeH = screenHeight > 0 && !isNaN(screenHeight) ? screenHeight : 2400;
    const trimmed = (responseContent || '').trim();

    // Helper for normalized point conversion
    const convertPoint = (rawX: number, rawY: number, confidence: number = 0.9, label?: string): VisualGroundingResult => {
      const normX = rawX <= 1 ? Math.max(0, Math.min(1, rawX)) : rawX <= 1000 ? Math.max(0, Math.min(1, rawX / 1000)) : Math.max(0, Math.min(1, rawX / safeW));
      const normY = rawY <= 1 ? Math.max(0, Math.min(1, rawY)) : rawY <= 1000 ? Math.max(0, Math.min(1, rawY / 1000)) : Math.max(0, Math.min(1, rawY / safeH));
      const px = rawX > 1000 ? Math.max(0, Math.min(safeW, Math.round(rawX))) : Math.round(normX * safeW);
      const py = rawY > 1000 ? Math.max(0, Math.min(safeH, Math.round(rawY))) : Math.round(normY * safeH);
      return {
        found: true,
        x: px,
        y: py,
        normalizedX: normX,
        normalizedY: normY,
        confidence,
        elementLabel: label || targetQuery,
        rawResponse: trimmed,
      };
    };

    // 1. Try extracting JSON block (code fences, JSON object, or direct string)
    const jsonCandidates: string[] = [];
    const codeMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (codeMatch) {
      jsonCandidates.push(codeMatch[1].trim());
    }
    const braceMatch = trimmed.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonCandidates.push(braceMatch[0].trim());
    }
    jsonCandidates.push(trimmed);

    for (const candidate of jsonCandidates) {
      try {
        const parsed = JSON.parse(candidate);

        if (parsed && typeof parsed === 'object') {
          // Explicit not found signal
          if (parsed.found === false || parsed.found === 'false') {
            return {
              found: false,
              x: Math.round(safeW * 0.5),
              y: Math.round(safeH * 0.5),
              normalizedX: 0.5,
              normalizedY: 0.5,
              confidence: 0.0,
              elementLabel: targetQuery,
              rawResponse: trimmed,
            };
          }

          // Format A: { point: [x, y] } or { point: { x, y } }
          if (parsed.point) {
            if (Array.isArray(parsed.point) && parsed.point.length >= 2) {
              const rawX = Number(parsed.point[0]);
              const rawY = Number(parsed.point[1]);
              if (!isNaN(rawX) && !isNaN(rawY)) {
                return convertPoint(rawX, rawY, parsed.confidence || 0.9, parsed.label);
              }
            } else if (typeof parsed.point === 'object' && typeof parsed.point.x === 'number' && typeof parsed.point.y === 'number') {
              return convertPoint(parsed.point.x, parsed.point.y, parsed.confidence || 0.9, parsed.label);
            }
          }

          // Format B: { box_2d: [ymin, xmin, ymax, xmax] } or { box2d, bbox, bounds }
          const box = parsed.box_2d || parsed.box2d || parsed.bbox || parsed.bounds;
          if (box && (Array.isArray(box) || (typeof box === 'object' && 'ymin' in box))) {
            const scaled = this.scaleBoundingBox(box, safeW, safeH);
            const tupleBox = toTuple4(box) || [0, 0, 1000, 1000];
            return {
              found: true,
              x: scaled.centerX,
              y: scaled.centerY,
              normalizedX: scaled.centerX / safeW,
              normalizedY: scaled.centerY / safeH,
              confidence: parsed.confidence || 0.9,
              box2d: tupleBox,
              rawResponse: trimmed,
            };
          }

          // Format C: { x: number, y: number }
          if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
            return convertPoint(parsed.x, parsed.y, parsed.confidence || 0.85, parsed.label);
          }

          // Format D: elements array
          if (Array.isArray(parsed.elements) && parsed.elements.length > 0) {
            const lowerQuery = targetQuery.toLowerCase();
            const matched =
              parsed.elements.find((el: any) => (el?.label || el?.name || '').toLowerCase().includes(lowerQuery)) ||
              parsed.elements[0];

            if (matched) {
              const elBox = matched.box_2d || matched.box2d || matched.bbox || matched.bounds;
              if (elBox) {
                const scaled = this.scaleBoundingBox(elBox, safeW, safeH);
                return {
                  found: true,
                  x: scaled.centerX,
                  y: scaled.centerY,
                  normalizedX: scaled.centerX / safeW,
                  normalizedY: scaled.centerY / safeH,
                  confidence: matched.confidence || 0.85,
                  elementLabel: matched.label || targetQuery,
                  box2d: toTuple4(elBox),
                  rawResponse: trimmed,
                };
              }
              if (typeof matched.x === 'number' && typeof matched.y === 'number') {
                return convertPoint(matched.x, matched.y, matched.confidence || 0.85, matched.label);
              }
            }
          }
        }
      } catch (_e) {
        // Continue to next candidate or fallback
      }
    }

    // 2. Regex fallback: [ymin, xmin, ymax, xmax]
    const boxMatch = trimmed.match(/(?:box_2d|box2d|bbox|bounds|box)?\s*:?\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]/i);
    if (boxMatch) {
      const ymin = parseFloat(boxMatch[1]);
      const xmin = parseFloat(boxMatch[2]);
      const ymax = parseFloat(boxMatch[3]);
      const xmax = parseFloat(boxMatch[4]);
      const scaled = this.scaleBoundingBox([ymin, xmin, ymax, xmax], safeW, safeH);
      return {
        found: true,
        x: scaled.centerX,
        y: scaled.centerY,
        normalizedX: scaled.centerX / safeW,
        normalizedY: scaled.centerY / safeH,
        confidence: 0.8,
        elementLabel: targetQuery,
        box2d: [ymin, xmin, ymax, xmax],
        rawResponse: trimmed,
      };
    }

    // 3. Regex fallback: explicit point / coordinates with keywords or formatted structures
    const pointKeyMatch = trimmed.match(/(?:point|coord|coordinate|coordinates|location|at|tap|click|position)\s*[:=]?\s*\(?\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)?/i);
    if (pointKeyMatch) {
      const rawX = parseFloat(pointKeyMatch[1]);
      const rawY = parseFloat(pointKeyMatch[2]);
      return convertPoint(rawX, rawY, 0.75);
    }

    const pointBracketMatch = trimmed.match(/(?:point|coord|coordinate|coordinates|location)\s*[:=]?\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]/i);
    if (pointBracketMatch) {
      const rawX = parseFloat(pointBracketMatch[1]);
      const rawY = parseFloat(pointBracketMatch[2]);
      return convertPoint(rawX, rawY, 0.75);
    }

    const xyMatch = trimmed.match(/x\s*[:=]\s*(\d+(?:\.\d+)?)\s*,\s*y\s*[:=]\s*(\d+(?:\.\d+)?)/i);
    if (xyMatch) {
      const rawX = parseFloat(xyMatch[1]);
      const rawY = parseFloat(xyMatch[2]);
      return convertPoint(rawX, rawY, 0.75);
    }

    const parenPointMatch = trimmed.match(/\(\s*(\d{2,4})\s*,\s*(\d{2,4})\s*\)/);
    if (parenPointMatch) {
      const rawX = parseInt(parenPointMatch[1], 10);
      const rawY = parseInt(parenPointMatch[2], 10);
      return convertPoint(rawX, rawY, 0.75);
    }

    // 4. Default: Center screen fallback
    return {
      found: false,
      x: Math.round(safeW * 0.5),
      y: Math.round(safeH * 0.5),
      normalizedX: 0.5,
      normalizedY: 0.5,
      confidence: 0.0,
      elementLabel: targetQuery,
      rawResponse: trimmed,
    };
  }

  /**
   * Accepts image base64 + prompt to extract UI elements, text coordinates, and active visual state.
   */
  async analyzeImage(base64Image: string, customPrompt?: string): Promise<VisionAnalysisResult> {
    if (NvidiaVisionProvider.mockHandler) {
      const mock = await NvidiaVisionProvider.mockHandler(base64Image, customPrompt || '');
      if (mock && typeof mock === 'object' && 'elements' in mock) {
        return mock as VisionAnalysisResult;
      }
      if (typeof mock === 'string') {
        return {
          description: mock,
          elements: [],
          rawText: mock,
        };
      }
    }

    const prompt =
      customPrompt ||
      `You are FRIDAY's visual perception engine. Analyze this Android mobile screen screenshot in detail.\n` +
      `Extract all visible UI elements, buttons, text fields, icons, and status information.\n` +
      `Respond with a valid JSON object matching this schema:\n` +
      `{\n` +
      `  "description": "Concise summary of what is visible on the screen",\n` +
      `  "activeAppHint": "Detected application name or type (e.g. YouTube, WhatsApp, Settings, Game)",\n` +
      `  "elements": [\n` +
      `    {\n` +
      `      "label": "Text or description of element",\n` +
      `      "type": "button | text | input | icon | card | image",\n` +
      `      "box2d": [ymin, xmin, ymax, xmax],\n` +
      `      "confidence": 0.95\n` +
      `    }\n` +
      `  ]\n` +
      `}\n` +
      `Note: [ymin, xmin, ymax, xmax] must be normalized between 0 and 1000.`;

    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: toImageDataUrl(base64Image), detail: 'high' } },
        ],
      },
    ];

    try {
      const responseText = await this.generateText(messages);
      let parsed: any;
      try {
        const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        const toParse = jsonMatch ? jsonMatch[1].trim() : (responseText.match(/\{[\s\S]*\}/)?.[0] || responseText.trim());
        parsed = JSON.parse(toParse);
      } catch (_e) {
        // Fallback for truncated JSON: recover complete elements via regex
        const recoveredElements: any[] = [];
        const elementRegex = /\{\s*"label"\s*:\s*"([^"]+)"[\s\S]*?"(?:box2d|box_2d|bbox)"\s*:\s*\[\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\]/gi;
        let match: RegExpExecArray | null;
        while ((match = elementRegex.exec(responseText)) !== null) {
          recoveredElements.push({
            label: match[1],
            type: 'unknown',
            box2d: [parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4]), parseFloat(match[5])],
            confidence: 0.8,
          });
        }
        parsed = {
          description: responseText.slice(0, 200),
          elements: recoveredElements,
        };
      }

      const rawElements: any[] = Array.isArray(parsed.elements) ? parsed.elements : [];
      const elements: VisualElement[] = rawElements.map((el) => {
        const box2d = el.box2d || el.box_2d || el.bbox;
        const bounds = box2d ? NvidiaVisionProvider.scaleBoundingBox(box2d) : undefined;
        return {
          label: el.label || el.name || 'Unknown element',
          type: el.type || 'unknown',
          box2d: (Array.isArray(box2d) && box2d.length >= 4
            ? [box2d[0], box2d[1], box2d[2], box2d[3]]
            : undefined) as [number, number, number, number] | undefined,
          bounds,
          confidence: typeof el.confidence === 'number' ? el.confidence : 0.9,
          description: el.description,
        };
      });

      return {
        description: parsed.description || responseText.slice(0, 200),
        elements,
        activeAppHint: parsed.activeAppHint,
        rawText: responseText,
        suggestedAction: parsed.suggestedAction,
      };
    } catch (err: any) {
      Logger.warn('NvidiaVisionProvider.analyzeImage error', err?.message || err);
      return {
        description: 'Visual analysis unavailable due to network or provider error.',
        elements: [],
        rawText: err?.message,
      };
    }
  }

  /**
   * Grounds a target visual query (e.g. "search button", "profile avatar", "play video") to exact screen coordinates.
   */
  async groundVisualElement(
    base64Image: string,
    targetQuery: string,
    screenWidth: number = 1080,
    screenHeight: number = 2400
  ): Promise<VisualGroundingResult> {
    const safeW = screenWidth > 0 && !isNaN(screenWidth) ? screenWidth : 1080;
    const safeH = screenHeight > 0 && !isNaN(screenHeight) ? screenHeight : 2400;

    if (NvidiaVisionProvider.mockHandler) {
      const mock = await NvidiaVisionProvider.mockHandler(base64Image, targetQuery);
      if (mock && typeof mock === 'object' && 'x' in mock && 'y' in mock) {
        return mock as VisualGroundingResult;
      }
      if (typeof mock === 'string') {
        return NvidiaVisionProvider.parseGroundingResponse(mock, targetQuery, safeW, safeH);
      }
    }

    const prompt =
      `Locate the visual UI element corresponding to: "${targetQuery}" on this mobile screen.\n` +
      `Return the exact 2D bounding box normalized to 0-1000 scale.\n` +
      `Respond with ONLY a JSON object:\n` +
      `{\n` +
      `  "found": true,\n` +
      `  "label": "${targetQuery}",\n` +
      `  "box_2d": [ymin, xmin, ymax, xmax],\n` +
      `  "confidence": 0.95\n` +
      `}`;

    const messages: ModelMessage[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: toImageDataUrl(base64Image), detail: 'high' } },
        ],
      },
    ];

    try {
      const responseText = await this.generateText(messages);
      return NvidiaVisionProvider.parseGroundingResponse(responseText, targetQuery, safeW, safeH);
    } catch (err: any) {
      Logger.warn(`NvidiaVisionProvider.groundVisualElement failed for "${targetQuery}"`, err?.message || err);
      return {
        found: false,
        x: Math.round(safeW * 0.5),
        y: Math.round(safeH * 0.5),
        normalizedX: 0.5,
        normalizedY: 0.5,
        confidence: 0.0,
        elementLabel: targetQuery,
        rawResponse: err?.message,
      };
    }
  }

  private formatApiError(status: number, errorText: string): string {
    let hint = '';
    if (status === 401) {
      hint = ' (Unauthorized: invalid or missing NVIDIA API key)';
    } else if (status === 403) {
      hint = ' (Forbidden: model access denied or insufficient permissions)';
    } else if (status === 429) {
      hint = ' (Rate limit exceeded: quota exhausted or concurrent request limit reached)';
    } else if (status === 503) {
      hint = ' (Service temporarily unavailable from NVIDIA NIM)';
    }
    return `NVIDIA Vision API error (${status}${hint}): ${errorText}`;
  }

  async generateText(messages: ModelMessage[]): Promise<string> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      if (process.env.NODE_ENV === 'test') {
        return JSON.stringify({
          description: 'Mock Vision Analysis Screen',
          activeAppHint: 'com.android.launcher',
          elements: [
            { label: 'Search', type: 'button', box2d: [100, 200, 200, 800], confidence: 0.95 },
            { label: 'Play', type: 'button', box2d: [400, 400, 600, 600], confidence: 0.9 },
          ],
        });
      }
      throw new Error('NVIDIA API Key not configured for Vision Provider');
    }

    try {
      const response = await fetchWithTimeout(
        this.baseUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.getModelFor(messages),
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            temperature: 0.1,
            max_tokens: 800,
          }),
        },
        hasImageContent(messages) ? VISION_REQUEST_TIMEOUT_MS : TEXT_REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(this.formatApiError(response.status, errorBody));
      }

      const data = await response.json();
      return data?.choices?.[0]?.message?.content || '';
    } catch (err: any) {
      Logger.error('NvidiaVisionProvider generateText error', err);
      throw err;
    }
  }

  async generateToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      if (process.env.NODE_ENV === 'test') {
        return {
          toolName: 'visual_tap',
          parameters: { query: 'search' },
          rawReply: 'Tapping search visually',
        };
      }
      throw new Error('NVIDIA API Key not configured');
    }

    const response = await fetchWithTimeout(
      this.baseUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.getModelFor(messages),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          tools,
          tool_choice: 'auto',
          temperature: 0.1,
          max_tokens: 400,
        }),
      },
      hasImageContent(messages) ? VISION_REQUEST_TIMEOUT_MS : TEXT_REQUEST_TIMEOUT_MS
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(this.formatApiError(response.status, errorBody));
    }

    const data = await response.json();
    const choice = data?.choices?.[0]?.message;

    if (choice?.tool_calls && choice.tool_calls.length > 0) {
      const call = choice.tool_calls[0];
      let parsedArgs: any = {};
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}');
      } catch (_e) {
        parsedArgs = { rawArguments: call.function.arguments };
      }
      return {
        toolName: call.function.name,
        parameters: parsedArgs,
        rawReply: choice.content || undefined,
      };
    }

    if (choice?.content) {
      return { toolName: 'none', parameters: { reply: choice.content }, rawReply: choice.content };
    }

    throw new Error('NVIDIA Vision returned neither a tool call nor content');
  }

  reasonToolCall(messages: ModelMessage[], tools: any[]): Promise<ToolCallResult> {
    return this.generateToolCall(messages, tools);
  }
}
