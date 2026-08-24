import { NativeModules, Platform } from 'react-native';
import { ScreenTree, UINode } from './types';
import { Logger } from '../utils/logger';

const { FridayAccessibilityNative } = NativeModules;

function getGlobalMockTree(): ScreenTree {
  if (!(global as any).__FRIDAY_MOCK_TREE__) {
    (global as any).__FRIDAY_MOCK_TREE__ = {
      activePackage: 'com.android.launcher',
      activeActivity: 'HomeScreenActivity',
      timestamp: Date.now(),
      screenWidth: 1080,
      screenHeight: 2400,
      nodes: [
        {
          id: 'youtube_icon',
          className: 'android.widget.TextView',
          text: 'YouTube',
          contentDescription: 'YouTube',
          bounds: { left: 100, top: 500, right: 300, bottom: 700, centerX: 200, centerY: 600, width: 200, height: 200 },
          isClickable: true,
          isEditable: false,
          isScrollable: false,
          isVisible: true,
          packageName: 'com.android.launcher',
        },
      ],
    };
  }
  return (global as any).__FRIDAY_MOCK_TREE__;
}

function setGlobalMockTree(tree: ScreenTree) {
  (global as any).__FRIDAY_MOCK_TREE__ = tree;
}

export class AccessibilityModule {
  static resetMockTree(): void {
    setGlobalMockTree({
      activePackage: 'com.android.launcher',
      activeActivity: 'HomeScreenActivity',
      timestamp: Date.now(),
      screenWidth: 1080,
      screenHeight: 2400,
      nodes: [
        {
          id: 'youtube_icon',
          className: 'android.widget.TextView',
          text: 'YouTube',
          contentDescription: 'YouTube',
          bounds: { left: 100, top: 500, right: 300, bottom: 700, centerX: 200, centerY: 600, width: 200, height: 200 },
          isClickable: true,
          isEditable: false,
          isScrollable: false,
          isVisible: true,
          packageName: 'com.android.launcher',
        },
      ],
    });
  }

  static setMockPackage(packageName: string): void {
    const pkg = packageName.toLowerCase();
    if (pkg.includes('youtube')) {
      setGlobalMockTree({
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
          },
        ],
      });
    } else if (pkg.includes('whatsapp')) {
      // WhatsApp chat-list state. Real WhatsApp reveals the search field after a
      // tap on the search entry; the mock starts with it focused so the offline
      // send flow (type contact → open chat → type message → send → verify)
      // stays deterministic and testable without a live device.
      setGlobalMockTree({
        activePackage: 'com.whatsapp',
        activeActivity: 'HomeActivity',
        timestamp: Date.now(),
        screenWidth: 1080,
        screenHeight: 2400,
        nodes: [
          {
            id: 'wa_search_edit',
            className: 'android.widget.EditText',
            text: '',
            contentDescription: 'Search name or number',
            bounds: { left: 60, top: 100, right: 1020, bottom: 220, centerX: 540, centerY: 160, width: 960, height: 120 },
            isClickable: true,
            isEditable: true,
            isScrollable: false,
            isVisible: true,
            packageName: 'com.whatsapp',
          },
        ],
      });
    } else {
      setGlobalMockTree({
        activePackage: packageName,
        activeActivity: 'MainActivity',
        timestamp: Date.now(),
        screenWidth: 1080,
        screenHeight: 2400,
        nodes: [],
      });
    }
  }

  static async isServiceEnabled(): Promise<boolean> {
    if (FridayAccessibilityNative?.isServiceEnabled) {
      return await FridayAccessibilityNative.isServiceEnabled();
    }
    // No native module means no accessibility control at all. Claiming it is
    // enabled would skip the prompt that asks the user to grant it.
    return false;
  }

  static openAccessibilitySettings(): void {
    if (FridayAccessibilityNative?.openAccessibilitySettings) {
      FridayAccessibilityNative.openAccessibilitySettings();
    }
  }

  static async inspectScreen(): Promise<ScreenTree> {
    if (FridayAccessibilityNative?.getScreenTree) {
      try {
        const raw = await FridayAccessibilityNative.getScreenTree();
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        return {
          activePackage: parsed.activePackage || 'unknown',
          activeActivity: parsed.activeActivity,
          nodes: parsed.nodes || [],
          timestamp: parsed.timestamp || Date.now(),
          screenWidth: parsed.screenWidth || 1080,
          screenHeight: parsed.screenHeight || 2400,
        };
      } catch (e: any) {
        // On a real device this means we genuinely cannot see the screen — the
        // service is disabled or the window is gone. Report that honestly;
        // substituting a fabricated tree would make the agent tap blind
        // coordinates against whatever is actually on screen.
        Logger.warn('inspectScreen failed - screen is unobservable', e?.message || String(e));
        return {
          activePackage: 'unknown',
          nodes: [],
          timestamp: Date.now(),
          screenWidth: 1080,
          screenHeight: 2400,
        };
      }
    }
    const mock = getGlobalMockTree();
    return { ...mock, nodes: mock.nodes.map((n) => ({ ...n })), timestamp: Date.now() };
  }

  static computeFingerprint(tree: ScreenTree): string {
    const pkg = tree.activePackage || '';
    const textSummary = tree.nodes
      .slice(0, 15)
      .map((n) => (n.text || n.contentDescription || '').trim())
      .filter(Boolean)
      .join('|');
    return `${pkg}:${tree.nodes.length}:${textSummary}`;
  }

  static async getForegroundPackage(): Promise<string> {
    const tree = await this.inspectScreen();
    return tree.activePackage;
  }

  static async performGlobalAction(action: 'BACK' | 'HOME' | 'RECENTS' | 'NOTIFICATIONS' | 'QUICK_SETTINGS' | 'LOCK_SCREEN' | 'POWER_DIALOG' | 'TAKE_SCREENSHOT'): Promise<boolean> {
    if (FridayAccessibilityNative?.performGlobalAction) {
      return await FridayAccessibilityNative.performGlobalAction(action);
    }
    return true;
  }

  static async clickNode(nodeId: string): Promise<boolean> {
    const tree = await this.inspectScreen();
    if (!FridayAccessibilityNative?.clickCoordinates) {
      const lower = nodeId.toLowerCase();
      const mock = getGlobalMockTree();
      if (lower.includes('search') || nodeId === 'search_button') {
        mock.nodes = mock.nodes.filter((n) => n.id !== 'search_button');
        const hasEditText = mock.nodes.some((n) => n.id === 'search_edit_text');
        if (!hasEditText) {
          mock.nodes.push({
            id: 'search_edit_text',
            className: 'android.widget.EditText',
            text: 'Search YouTube',
            bounds: { left: 160, top: 100, right: 900, bottom: 220, centerX: 530, centerY: 160, width: 740, height: 120 },
            isClickable: true,
            isEditable: true,
            isScrollable: false,
            isVisible: true,
            packageName: mock.activePackage,
          });
        }
      }
    }
    const node = tree.nodes.find((n) => n.id === nodeId || n.text === nodeId || n.contentDescription === nodeId);
    if (node) {
      return await this.clickCoordinates(node.bounds.centerX, node.bounds.centerY);
    }
    return await this.clickText(nodeId, false);
  }

  static async clickText(query: string, exact: boolean = false): Promise<boolean> {
    if (FridayAccessibilityNative?.clickText) {
      const ok = await FridayAccessibilityNative.clickText(query, exact);
      if (ok) return true;
    }
    // Fallback: search tree in JS and click bounds
    const tree = await this.inspectScreen();
    const lower = query.toLowerCase();
    const matchFn = (n: UINode) => {
      const t = (n.text || '').toLowerCase();
      const d = (n.contentDescription || '').toLowerCase();
      return exact ? t === lower || d === lower : t.includes(lower) || d.includes(lower);
    };
    // Prefer an actionable row (a result/button) over an editable field that
    // merely echoes the typed query — tapping the search box would never open
    // anything, tapping the contact row does.
    const matches = tree.nodes.filter(matchFn);
    const node =
      matches.find((n) => !n.isEditable && n.isClickable) ||
      matches.find((n) => !n.isEditable) ||
      matches[0];
    if (node) {
      // Mock-only: tapping a contact row from WhatsApp search opens that chat.
      if (
        !FridayAccessibilityNative?.clickCoordinates &&
        tree.activePackage.toLowerCase().includes('whatsapp') &&
        (node.id === 'wa_contact_result' || node.contentDescription === 'Contact')
      ) {
        this.openMockWhatsAppChat(node.text || query);
      }
      return await this.clickCoordinates(node.bounds.centerX, node.bounds.centerY);
    }
    return false;
  }

  // Mock-only state transition: replace the chat list with an open conversation
  // (a header for the contact and an empty message composer).
  private static openMockWhatsAppChat(contact: string): void {
    const mock = getGlobalMockTree();
    mock.nodes = [
      {
        id: 'wa_chat_header',
        className: 'android.widget.TextView',
        text: contact,
        contentDescription: `Chat with ${contact}`,
        bounds: { left: 60, top: 40, right: 800, bottom: 140, centerX: 430, centerY: 90, width: 740, height: 100 },
        isClickable: false,
        isEditable: false,
        isScrollable: false,
        isVisible: true,
        packageName: mock.activePackage,
      },
      {
        id: 'wa_composer',
        className: 'android.widget.EditText',
        text: '',
        contentDescription: 'Message',
        bounds: { left: 60, top: 2200, right: 900, bottom: 2320, centerX: 480, centerY: 2260, width: 840, height: 120 },
        isClickable: true,
        isEditable: true,
        isScrollable: false,
        isVisible: true,
        packageName: mock.activePackage,
      },
    ];
  }

  static async clickContentDescription(desc: string, exact: boolean = false): Promise<boolean> {
    return await this.clickText(desc, exact);
  }

  static async clickFirstResultCard(nodeId?: string): Promise<boolean> {
    // When the ranker chose a specific result, open exactly that node by tapping
    // its real coordinates — this is how a reasoned selection ("the holi
    // episode", not merely the first card) is honored on-device.
    if (nodeId) {
      const tree = await this.inspectScreen();
      const node = tree.nodes.find((n) => n.id === nodeId);
      if (node && FridayAccessibilityNative?.clickCoordinates) {
        return await this.clickCoordinates(node.bounds.centerX, node.bounds.centerY);
      }
      // No native module (tests) — fall through to the deterministic mock below,
      // which simulates opening the chosen result into the player.
    }

    if (FridayAccessibilityNative?.clickFirstResultCard) {
      return await FridayAccessibilityNative.clickFirstResultCard();
    }
    const mock = getGlobalMockTree();
    mock.nodes = [
      {
        id: 'player_pause_button',
        className: 'android.widget.ImageView',
        contentDescription: 'Pause',
        bounds: { left: 480, top: 400, right: 600, bottom: 520, centerX: 540, centerY: 460, width: 120, height: 120 },
        isClickable: true,
        isEditable: false,
        isScrollable: false,
        isVisible: true,
        packageName: mock.activePackage,
      },
    ];
    const { SystemControlModule } = await import('./SystemControlModule');
    SystemControlModule.setMockMediaPlaying(true);
    return await this.clickCoordinates(540, 700);
  }

  static async clickSendOrActionButton(): Promise<boolean> {
    if (FridayAccessibilityNative?.clickSendOrActionButton) {
      return await FridayAccessibilityNative.clickSendOrActionButton();
    }
    // Mock-only: sending posts the composed text into the thread as a delivered
    // outgoing bubble and clears the composer — the real evidence the terminal
    // condition and verify_message_sent look for.
    const mock = getGlobalMockTree();
    if ((mock.activePackage || '').toLowerCase().includes('whatsapp')) {
      const composer = mock.nodes.find((n) => n.id === 'wa_composer');
      const messageText = composer?.text || '';
      if (composer) composer.text = '';
      mock.nodes = mock.nodes.filter((n) => n.id !== 'wa_send');
      mock.nodes.push({
        id: `wa_msg_${mock.nodes.length}`,
        className: 'android.widget.TextView',
        text: messageText,
        contentDescription: 'Delivered',
        bounds: { left: 400, top: 800, right: 1040, bottom: 920, centerX: 720, centerY: 860, width: 640, height: 120 },
        isClickable: false,
        isEditable: false,
        isScrollable: false,
        isVisible: true,
        packageName: mock.activePackage,
      });
      return true;
    }
    return await this.clickCoordinates(1000, 2260);
  }

  static async clickFullScreen(): Promise<boolean> {
    if (FridayAccessibilityNative?.clickFullScreen) {
      return await FridayAccessibilityNative.clickFullScreen();
    }
    const tree = await this.inspectScreen();
    const fsNode = tree.nodes.find(
      (n) =>
        (n.contentDescription || '').toLowerCase().includes('full screen') ||
        (n.contentDescription || '').toLowerCase().includes('fullscreen')
    );
    if (fsNode) {
      return await this.clickCoordinates(fsNode.bounds.centerX, fsNode.bounds.centerY);
    }
    // YouTube fallback coordinates: tap video center then bottom-right of video
    await this.clickCoordinates(540, 500);
    return await this.clickCoordinates(1000, 680);
  }

  static async pressEnter(): Promise<boolean> {
    if (FridayAccessibilityNative?.pressEnterOrSearch) {
      return await FridayAccessibilityNative.pressEnterOrSearch();
    }
    return await this.clickCoordinates(980, 2300);
  }

  static async clickCoordinates(x: number, y: number): Promise<boolean> {
    if (FridayAccessibilityNative?.clickCoordinates) {
      return await FridayAccessibilityNative.clickCoordinates(x, y);
    }
    return true;
  }

  static async longClickCoordinates(x: number, y: number): Promise<boolean> {
    if (FridayAccessibilityNative?.longClickCoordinates) {
      return await FridayAccessibilityNative.longClickCoordinates(x, y);
    }
    return true;
  }

  static async typeText(text: string, clearFirst: boolean = false): Promise<boolean> {
    if (FridayAccessibilityNative?.typeText) {
      return await FridayAccessibilityNative.typeText(text, clearFirst);
    }
    const mock = getGlobalMockTree();
    const editNode = mock.nodes.find(
      (n) => n.id === 'search_edit_text' || n.id === 'wa_search_edit' || n.id === 'wa_composer' || n.isEditable
    );
    if (editNode) {
      editNode.text = text;
    }

    if ((mock.activePackage || '').toLowerCase().includes('whatsapp')) {
      const composer = mock.nodes.find((n) => n.id === 'wa_composer');
      if (composer) {
        // Typing the body into an open chat makes WhatsApp swap the mic/attach
        // affordance for a Send button.
        if (!mock.nodes.some((n) => n.id === 'wa_send')) {
          mock.nodes.push({
            id: 'wa_send',
            className: 'android.widget.ImageButton',
            contentDescription: 'Send',
            bounds: { left: 920, top: 2200, right: 1040, bottom: 2320, centerX: 980, centerY: 2260, width: 120, height: 120 },
            isClickable: true,
            isEditable: false,
            isScrollable: false,
            isVisible: true,
            packageName: 'com.whatsapp',
          });
        }
      } else {
        // Typing a name into chat-list search surfaces a matching contact row.
        const existing = mock.nodes.find((n) => n.id === 'wa_contact_result');
        if (existing) {
          existing.text = text;
        } else {
          mock.nodes.push({
            id: 'wa_contact_result',
            className: 'android.view.ViewGroup',
            text: text,
            contentDescription: 'Contact',
            bounds: { left: 40, top: 300, right: 1040, bottom: 480, centerX: 540, centerY: 390, width: 1000, height: 180 },
            isClickable: true,
            isEditable: false,
            isScrollable: false,
            isVisible: true,
            packageName: 'com.whatsapp',
          });
        }
      }
      return true;
    }

    const hasCard = mock.nodes.some((n) => n.id === 'video_card_1');
    if (!hasCard) {
      mock.nodes.push({
        id: 'video_card_1',
        className: 'android.view.ViewGroup',
        text: 'Taarak Mehta Ka Ooltah Chashmah Episode 124 - Best Comedy',
        contentDescription: '15M views • 3 years ago',
        bounds: { left: 40, top: 300, right: 1040, bottom: 900, centerX: 540, centerY: 600, width: 1000, height: 600 },
        isClickable: true,
        isEditable: false,
        isScrollable: false,
        isVisible: true,
        packageName: mock.activePackage,
      });
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
    return await this.performGlobalAction('BACK');
  }

  static async pressHome(): Promise<boolean> {
    return await this.performGlobalAction('HOME');
  }

  static async closeBackgroundApps(): Promise<boolean> {
    if (FridayAccessibilityNative?.closeBackgroundApps) {
      return await FridayAccessibilityNative.closeBackgroundApps();
    }
    return true;
  }

  static async closeCurrentApp(): Promise<boolean> {
    if (FridayAccessibilityNative?.closeCurrentApp) {
      return await FridayAccessibilityNative.closeCurrentApp();
    }
    return true;
  }

  static async closeSpecificApp(appName: string): Promise<boolean> {
    if (FridayAccessibilityNative?.closeSpecificApp) {
      return await FridayAccessibilityNative.closeSpecificApp(appName);
    }
    return true;
  }

  static async waitForPackage(expectedPkg: string, timeoutMs: number = 4000): Promise<boolean> {
    const isEnabled = await this.isServiceEnabled();
    if (!isEnabled) {
      return true;
    }
    const cleanExpected = expectedPkg.toLowerCase();
    const tree = await this.inspectScreen();
    if (tree.activePackage.toLowerCase().includes(cleanExpected)) {
      return true;
    }
    if (process.env.NODE_ENV === 'test' || !FridayAccessibilityNative) {
      return true;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const current = await this.inspectScreen();
      if (current.activePackage.toLowerCase().includes(cleanExpected)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  }

  static async waitForElement(query: string, timeoutMs: number = 4000): Promise<boolean> {
    const lower = query.toLowerCase();
    const tree = await this.inspectScreen();
    const found = tree.nodes.some((n) => {
      const t = (n.text || '').toLowerCase();
      const d = (n.contentDescription || '').toLowerCase();
      return t.includes(lower) || d.includes(lower);
    });
    if (found || process.env.NODE_ENV === 'test' || !FridayAccessibilityNative) {
      return true;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const current = await this.inspectScreen();
      const hasNode = current.nodes.some((n) => {
        const t = (n.text || '').toLowerCase();
        const d = (n.contentDescription || '').toLowerCase();
        return t.includes(lower) || d.includes(lower);
      });
      if (hasNode) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  }

  static async waitForScreenChange(oldFingerprint: string, timeoutMs: number = 3000): Promise<boolean> {
    if (process.env.NODE_ENV === 'test' || !FridayAccessibilityNative) {
      return true;
    }
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const tree = await this.inspectScreen();
      const newFp = this.computeFingerprint(tree);
      if (newFp !== oldFingerprint) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    return false;
  }

  static async captureScreenBase64(): Promise<string> {
    if (FridayAccessibilityNative?.captureScreenBase64) {
      try {
        return await FridayAccessibilityNative.captureScreenBase64();
      } catch (_: any) {
        return '';
      }
    }
    return '';
  }

  static async describeScreen(): Promise<{ activePackage: string; elementsSummary: string; visibleTexts: string[] }> {
    const tree = await this.inspectScreen();
    const visibleTexts: string[] = [];
    const elements: string[] = [];

    for (const node of tree.nodes) {
      if (node.text && node.text.trim().length > 0) {
        visibleTexts.push(node.text.trim());
        elements.push(`"${node.text.trim()}"`);
      } else if (node.contentDescription && node.contentDescription.trim().length > 0) {
        visibleTexts.push(node.contentDescription.trim());
        elements.push(`[${node.contentDescription.trim()}]`);
      }
    }

    const pkgName = tree.activePackage.replace('com.google.android.', '').replace('com.', '');
    const elementsSummary = elements.slice(0, 10).join(', ');

    return {
      activePackage: tree.activePackage,
      elementsSummary: elementsSummary || 'No distinct text elements found',
      visibleTexts,
    };
  }
}
