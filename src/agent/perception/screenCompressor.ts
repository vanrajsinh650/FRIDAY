import { ScreenTree, UINode } from '../../native/types';

export interface CompressedElement {
  id: number;
  nodeId: string;
  role: string;
  label: string;
  centerX: number;
  centerY: number;
  states: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  isClickable: boolean;
  isEditable: boolean;
}

export interface CompressionResult {
  dsl: string;
  elements: CompressedElement[];
  elementCount: number;
  tokenEstimate: number;
}

export class ScreenCompressor {
  /**
   * Compresses a full ScreenTree into a concise, token-efficient DSL (~250-400 tokens).
   * Aggregates card text, filters out invisible/off-screen nodes, and numbers interactive targets.
   */
  static compress(tree: ScreenTree): CompressionResult {
    const elements: CompressedElement[] = [];
    const lines: string[] = [];
    let counter = 1;

    const screenW = tree.screenWidth || 1080;
    const screenH = tree.screenHeight || 2400;

    for (const node of tree.nodes) {
      if (!node.isVisible) continue;

      const { left, top, right, bottom, centerX, centerY, width, height } = node.bounds;
      // Viewport culling
      if (width <= 0 || height <= 0 || right < 0 || left > screenW || bottom < 0 || top > screenH) {
        continue;
      }

      const text = (node.text || '').trim();
      const desc = (node.contentDescription || '').trim();
      const label = text && desc && text !== desc ? `${text} - ${desc}` : text || desc;

      const isInteractive = node.isClickable || node.isEditable || node.isScrollable;
      if (!isInteractive && label.length === 0) {
        // Drop pure empty layout wrappers
        continue;
      }

      // Map concise role
      let role = 'VIEW';
      const cls = (node.className || '').toLowerCase();
      if (node.isEditable || cls.includes('edittext')) {
        role = 'INPUT';
      } else if (cls.includes('checkbox') || cls.includes('switch') || cls.includes('radio')) {
        role = 'TOGGLE';
      } else if (node.isClickable || cls.includes('button')) {
        role = 'BUTTON';
      } else if (node.isScrollable || cls.includes('recyclerview') || cls.includes('scrollview')) {
        role = 'LIST';
      } else if (cls.includes('imageview') || cls.includes('icon')) {
        role = 'ICON';
      } else if (label.length > 0) {
        role = 'TEXT';
      }

      // State flags
      const stateFlags: string[] = [];
      if (node.isClickable) stateFlags.push('C');
      if (node.isEditable) stateFlags.push('E');
      if (node.isScrollable) stateFlags.push('S');
      const states = stateFlags.length > 0 ? `[${stateFlags.join('')}]` : '';

      const elem: CompressedElement = {
        id: counter,
        nodeId: node.id,
        role,
        label,
        centerX,
        centerY,
        states,
        bounds: { left, top, right, bottom },
        isClickable: node.isClickable,
        isEditable: node.isEditable,
      };

      elements.push(elem);
      const labelStr = label ? `"${label}"` : '';
      lines.push(`[${counter}] <${role}> ${labelStr} (${centerX}, ${centerY}) ${states}`.trim());
      counter++;
    }

    const dsl = lines.join('\n');
    const tokenEstimate = Math.ceil(dsl.length / 4);

    return {
      dsl,
      elements,
      elementCount: elements.length,
      tokenEstimate,
    };
  }
}
