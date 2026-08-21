import { ToolDefinition } from './types';
import { AccessibilityModule } from '../native/AccessibilityModule';

export const inspectScreenTool: ToolDefinition = {
  name: 'inspect_screen',
  description: 'Inspects the current phone screen via Accessibility Service, returning interactive clickable/editable UI nodes and visible text.',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async () => {
    const startTime = Date.now();
    const tree = await AccessibilityModule.inspectScreen();
    return { success: true, data: tree, durationMs: Date.now() - startTime };
  },
};

export const clickNodeTool: ToolDefinition = {
  name: 'click_node',
  description: 'Clicks or taps a specific UI element node identified by its ID or text label.',
  parameters: {
    type: 'object',
    properties: {
      nodeId: { type: 'string', description: 'ID of the UI node to tap' },
    },
    required: ['nodeId'],
  },
  execute: async ({ nodeId }) => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.clickNode(nodeId);
    return { success: ok, data: { tappedNodeId: nodeId }, durationMs: Date.now() - startTime };
  },
};

export const typeTextTool: ToolDefinition = {
  name: 'type_text',
  description: 'Types text into the active focused input field or search bar.',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text string to type' },
      clearFirst: { type: 'boolean', description: 'Clear existing text before typing', default: true },
    },
    required: ['text'],
  },
  execute: async ({ text, clearFirst = true }) => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.typeText(text, clearFirst);
    return { success: ok, data: { typedText: text }, durationMs: Date.now() - startTime };
  },
};

export const scrollPageTool: ToolDefinition = {
  name: 'scroll_page',
  description: 'Scrolls the active window UP, DOWN, LEFT, or RIGHT to reveal more content.',
  parameters: {
    type: 'object',
    properties: {
      direction: { type: 'string', enum: ['UP', 'DOWN', 'LEFT', 'RIGHT'], description: 'Direction to scroll' },
    },
    required: ['direction'],
  },
  execute: async ({ direction }) => {
    const startTime = Date.now();
    const ok = await AccessibilityModule.scroll(direction);
    return { success: ok, data: { direction }, durationMs: Date.now() - startTime };
  },
};

export const pressBackTool: ToolDefinition = {
  name: 'press_back',
  description: 'Triggers the global Android Back button gesture.',
  parameters: { type: 'object', properties: {} },
  execute: async () => {
    const ok = await AccessibilityModule.pressBack();
    return { success: ok };
  },
};
