import { ModelMessage, MessageContentPart, extractText, toImageDataUrl } from '../providers/types';
import { AgentContextSnapshot } from '../types';
import { ScreenTree } from '../../native/types';
import { AccessibilityModule } from '../../native/AccessibilityModule';
import { useSettingsStore } from '../../state/settingsStore';
import { Logger } from '../../utils/logger';

// On-demand visual perception.
//
// The accessibility tree is the primary, cheapest way to "see" the screen — it
// hands us text, editable fields, content descriptions and clickable bounds for
// free. Vision (a screenshot through a VLM) is strictly a fallback for the case
// the tree cannot cover: Canvas/WebView surfaces, game UIs, or a momentarily
// unreadable window that returns almost no nodes. We escalate to a screenshot
// only then, and only when the user has vision fallback enabled — never every
// frame.
export class VisionPerception {
  // How many nodes actually carry human-meaningful content (text or a content
  // description). Pure layout/among nodes don't help a reasoner.
  private static informativeNodeCount(tree: ScreenTree): number {
    return tree.nodes.filter(
      (n) => (n.text && n.text.trim().length > 0) || (n.contentDescription && n.contentDescription.trim().length > 0)
    ).length;
  }

  // The tree is "unreadable" when the window is unknown or it exposes almost no
  // meaningful nodes — the signal that accessibility alone won't let us act.
  static isTreeSparse(tree: ScreenTree): boolean {
    if (!tree || tree.activePackage === 'unknown') return true;
    return this.informativeNodeCount(tree) <= 1;
  }

  // Return messages augmented with a screenshot ONLY when warranted. Otherwise
  // the input is returned unchanged, so text-only reasoning is the default path.
  static async augment(messages: ModelMessage[], snapshot: AgentContextSnapshot): Promise<ModelMessage[]> {
    const settings = useSettingsStore.getState();
    if (!settings.visionFallbackEnabled) return messages;
    if (!this.isTreeSparse(snapshot.screenTree)) return messages;

    let base64: string;
    try {
      base64 = await AccessibilityModule.captureScreenBase64();
    } catch (err: any) {
      Logger.warn('VisionPerception: screenshot capture threw', err?.message || err);
      return messages;
    }
    // No capture available (e.g. native module absent, or permission missing) —
    // stay on the text path rather than sending an empty image.
    if (!base64) return messages;

    Logger.info('VisionPerception: tree sparse, escalating to screenshot vision');
    return this.attachImageToLastUser(messages, base64);
  }

  // Fold the screenshot into the last user turn as OpenAI-style content parts,
  // preserving the existing text and adding a short instruction to use the image.
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
          `${existingText}\n\n[SCREEN VISION] The accessibility tree for this screen was sparse, ` +
          `so here is a screenshot of the current screen. Use it to decide the next action.`,
      },
      { type: 'image_url', image_url: { url: toImageDataUrl(base64Jpeg), detail: 'high' } },
    ];
    out[idx] = { ...out[idx], content: parts };
    return out;
  }
}
