import { NativeModules, Platform } from 'react-native';
import { ScreenTree, UINode } from './types';

const { FridayAccessibilityNative } = NativeModules;

export class AccessibilityModule {
  private static mockTree: ScreenTree = {
    activePackage: 'com.google.android.youtube',
    activeActivity: 'WatchActivity',
    timestamp: Date.now(),
    screenWidth: 1080,
    screenHeight: 2400,
    nodes: [
      {
        id: 'search_button',
        className: 'android.widget.ImageView',
        contentDescription: 'Search',
        bounds: { left: 900, top: 100, right: 1020, bottom: 220, centerX: 960, centerY: 160, width: 120, height: 120 },
        isClickable: true,
        isEditable: false,
        isScrollable: false,
        isVisible: true,
        packageName: 'com.google.android.youtube',
      },
      {
        id: 'search_edit_text',
        className: 'android.widget.EditText',
        text: 'Search YouTube',
        bounds: { left: 160, top: 100, right: 900, bottom: 220, centerX: 530, centerY: 160, width: 740, height: 120 },
        isClickable: true,
        isEditable: true,
        isScrollable: false,
        isVisible: true,
        packageName: 'com.google.android.youtube',
      },
      {
        id: 'video_card_1',
        className: 'android.view.ViewGroup',
        text: 'Taarak Mehta Ka Ooltah Chashmah Episode 124 - Best Comedy',
        contentDescription: '15M views • 3 years ago',
        bounds: { left: 40, top: 300, right: 1040, bottom: 900, centerX: 540, centerY: 600, width: 1000, height: 600 },
        isClickable: true,
        isEditable: false,
        isScrollable: false,
        isVisible: true,
        packageName: 'com.google.android.youtube',
      }
    ]
  };

  static async isServiceEnabled(): Promise<boolean> {
    if (FridayAccessibilityNative?.isServiceEnabled) {
      return await FridayAccessibilityNative.isServiceEnabled();
    }
    return true; // Dev fallback
  }

  static openAccessibilitySettings(): void {
    if (FridayAccessibilityNative?.openAccessibilitySettings) {
      FridayAccessibilityNative.openAccessibilitySettings();
    }
  }

  static async inspectScreen(): Promise<ScreenTree> {
    if (FridayAccessibilityNative?.inspectScreen) {
      return await FridayAccessibilityNative.inspectScreen();
    }
    return { ...this.mockTree, timestamp: Date.now() };
  }

  static async clickNode(nodeId: string): Promise<boolean> {
    if (FridayAccessibilityNative?.clickNode) {
      return await FridayAccessibilityNative.clickNode(nodeId);
    }
    const node = this.mockTree.nodes.find((n) => n.id === nodeId);
    if (node) {
      return await this.clickCoordinates(node.bounds.centerX, node.bounds.centerY);
    }
    return false;
  }

  static async clickCoordinates(x: number, y: number): Promise<boolean> {
    if (FridayAccessibilityNative?.clickCoordinates) {
      return await FridayAccessibilityNative.clickCoordinates(x, y);
    }
    return true;
  }

  static async typeText(text: string, clearFirst: boolean = false): Promise<boolean> {
    if (FridayAccessibilityNative?.typeText) {
      return await FridayAccessibilityNative.typeText(text, clearFirst);
    }
    return true;
  }

  static async scroll(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): Promise<boolean> {
    if (FridayAccessibilityNative?.scroll) {
      return await FridayAccessibilityNative.scroll(direction);
    }
    return true;
  }

  static async swipe(startX: number, startY: number, endX: number, endY: number, durationMs: number = 300): Promise<boolean> {
    if (FridayAccessibilityNative?.swipe) {
      return await FridayAccessibilityNative.swipe(startX, startY, endX, endY, durationMs);
    }
    return true;
  }

  static async pressBack(): Promise<boolean> {
    if (FridayAccessibilityNative?.pressBack) {
      return await FridayAccessibilityNative.pressBack();
    }
    return true;
  }

  static async pressHome(): Promise<boolean> {
    if (FridayAccessibilityNative?.pressHome) {
      return await FridayAccessibilityNative.pressHome();
    }
    return true;
  }
}
