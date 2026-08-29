import { ScreenTree, UINode } from '../../native/types';

export interface GroundedElement {
  markId: number;
  nodeId?: string;
  className?: string;
  label: string;
  type: 'button' | 'input' | 'card' | 'icon' | 'tab' | 'text' | 'item';
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  centroid: {
    x: number;
    y: number;
  };
  isClickable: boolean;
  isEditable: boolean;
}

export interface GroundingState {
  activePackage: string;
  screenWidth: number;
  screenHeight: number;
  elements: GroundedElement[];
  markMap: Map<number, GroundedElement>;
  formattedCatalog: string;
}

export class GroundingEngine {
  /**
   * Builds an indexed Set-of-Marks element catalog from the accessibility tree and visual bounds.
   */
  static groundScreen(tree: ScreenTree, screenWidth: number = 1080, screenHeight: number = 2400): GroundingState {
    const elements: GroundedElement[] = [];
    const markMap = new Map<number, GroundedElement>();
    const safeW = screenWidth > 0 ? screenWidth : 1080;
    const safeH = screenHeight > 0 ? screenHeight : 2400;

    if (!tree || !tree.nodes || tree.nodes.length === 0) {
      return {
        activePackage: tree?.activePackage || 'unknown',
        screenWidth: safeW,
        screenHeight: safeH,
        elements: [],
        markMap,
        formattedCatalog: 'No interactive elements detected on screen.',
      };
    }

    let currentMarkId = 1;
    const seenCentroids = new Set<string>();

    for (const node of tree.nodes) {
      const text = (node.text || '').trim();
      const desc = (node.contentDescription || '').trim();
      const cls = (node.className || '').toLowerCase();
      const isClickable = Boolean(node.isClickable);
      const isEditable = Boolean(node.isEditable);
      const isCheckable = Boolean(node.isCheckable);

      // Extract bounding box
      let left = 0;
      let top = 0;
      let right = safeW;
      let bottom = safeH;

      if (node.bounds) {
        left = Math.max(0, node.bounds.left || 0);
        top = Math.max(0, node.bounds.top || 0);
        right = Math.min(safeW, node.bounds.right || safeW);
        bottom = Math.min(safeH, node.bounds.bottom || safeH);
      }

      const width = right - left;
      const height = bottom - top;

      // Ignore zero-size or offscreen elements
      if (width <= 10 || height <= 10 || top >= safeH || left >= safeW) {
        continue;
      }

      // Ignore full-screen root containers unless they are distinct cards
      if (width >= safeW * 0.98 && height >= safeH * 0.95 && !isClickable && !isEditable) {
        continue;
      }

      const label = desc || text || node.id || 'Interactive Element';
      const isInteractive = isClickable || isEditable || isCheckable || (text.length > 0 && width > 40 && height > 20);

      if (isInteractive && (text.length > 0 || desc.length > 0 || isEditable || isClickable)) {
        const cx = Math.round(left + width / 2);
        const cy = Math.round(top + height / 2);
        const centroidKey = `${Math.round(cx / 30)}_${Math.round(cy / 30)}`;

        // Avoid duplicate marks on the exact same spot
        if (seenCentroids.has(centroidKey) && !isEditable) {
          continue;
        }
        seenCentroids.add(centroidKey);

        let type: GroundedElement['type'] = 'item';
        if (isEditable || cls.includes('edittext') || cls.includes('input')) {
          type = 'input';
        } else if (cls.includes('button') || (isClickable && (text.length <= 25 || desc.length <= 25))) {
          type = 'button';
        } else if (cls.includes('image') || cls.includes('icon')) {
          type = 'icon';
        } else if (cls.includes('tab')) {
          type = 'tab';
        } else if (width > safeW * 0.7 && height > 100) {
          type = 'card';
        }

        const grounded: GroundedElement = {
          markId: currentMarkId,
          nodeId: node.id,
          className: node.className,
          label: label.length > 80 ? label.slice(0, 77) + '...' : label,
          type,
          bounds: { left, top, right, bottom, width, height },
          centroid: { x: cx, y: cy },
          isClickable,
          isEditable,
        };

        elements.push(grounded);
        markMap.set(currentMarkId, grounded);
        currentMarkId++;

        if (currentMarkId > 50) break; // Limit marks to top 50 to maintain prompt efficiency
      }
    }

    const lines: string[] = [];
    for (const el of elements) {
      const typeStr = el.isEditable ? '[INPUT]' : el.type === 'button' ? '[BUTTON]' : `[${el.type.toUpperCase()}]`;
      lines.push(`[${el.markId}] ${typeStr} "${el.label}" @ (${el.centroid.x}, ${el.centroid.y})`);
    }

    const formattedCatalog = lines.length > 0
      ? lines.join('\n')
      : 'No indexed interactive elements found. Rely on direct screen vision coordinates.';

    return {
      activePackage: tree.activePackage || 'unknown',
      screenWidth: safeW,
      screenHeight: safeH,
      elements,
      markMap,
      formattedCatalog,
    };
  }

  /**
   * Resolves physical pixel coordinates for an action that specifies either markId or coordinates.
   */
  static resolveCoordinates(
    action: { markId?: number; x?: number; y?: number },
    grounding: GroundingState
  ): { x: number; y: number } | null {
    if (typeof action.markId === 'number' && grounding.markMap.has(action.markId)) {
      const el = grounding.markMap.get(action.markId)!;
      return { x: el.centroid.x, y: el.centroid.y };
    }

    if (typeof action.x === 'number' && typeof action.y === 'number') {
      const safeX = Math.max(0, Math.min(grounding.screenWidth, action.x));
      const safeY = Math.max(0, Math.min(grounding.screenHeight, action.y));
      return { x: Math.round(safeX), y: Math.round(safeY) };
    }

    return null;
  }
}
