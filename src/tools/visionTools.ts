import { ToolDefinition, ToolResult } from './types';
import { VisionPerception } from '../agent/perception/visionPerception';

export const captureScreenVisionTool: ToolDefinition = {
  name: 'capture_screen_vision',
  description: 'Captures a live screenshot via MediaProjection/Accessibility, analyzes the screen with a Vision Language Model (VLM), and extracts visible text, bounding boxes, and interactive UI elements.',
  parameters: {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Optional custom prompt describing what visual information or elements to extract from the screen.',
      },
    },
  },
  execute: async (params?: { prompt?: string }): Promise<ToolResult> => {
    const startTime = Date.now();
    try {
      const analysis = await VisionPerception.analyzeScreen(params?.prompt);
      const elementCount = analysis.elements ? analysis.elements.length : 0;
      return {
        success: true,
        data: {
          ...analysis,
          elementCount,
          summary: analysis.description || `Extracted ${elementCount} visual elements from screen.`,
        },
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'Failed to capture or analyze screen vision.',
        durationMs: Date.now() - startTime,
      };
    }
  },
};

export const visualTapTool: ToolDefinition = {
  name: 'visual_tap',
  description: 'Grounds a visual description or UI element label to screen pixel coordinates (x, y) from a live screenshot and performs a touch tap (via Accessibility or Elevated touch).',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The visual description, icon name, or label of the target element to tap (e.g. "search button", "blue play button", "skip ad", "profile avatar").',
      },
      preferElevated: {
        type: 'boolean',
        description: 'Whether to prioritize elevated hardware touch (Shizuku/Root) over standard Accessibility gestures.',
        default: false,
      },
    },
    required: ['query'],
  },
  execute: async (params?: { query: string; preferElevated?: boolean }): Promise<ToolResult> => {
    if (!params || !params.query || typeof params.query !== 'string' || params.query.trim().length === 0) {
      return {
        success: false,
        error: 'Parameter "query" is required for visual_tap.',
      };
    }

    const startTime = Date.now();
    try {
      const result = await VisionPerception.executeVisualTap(params.query.trim(), Boolean(params.preferElevated));
      return {
        success: result.success,
        data: {
          query: params.query,
          x: result.x,
          y: result.y,
          confidence: result.confidence,
          method: result.method,
          action: 'visual_tap',
        },
        error: result.success
          ? undefined
          : result.confidence === 0
          ? `Target visual element "${params.query}" could not be located on the screen.`
          : `Failed to tap target visual element "${params.query}".`,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || `Failed to perform visual tap for "${params?.query}".`,
        durationMs: Date.now() - startTime,
      };
    }
  },
};
