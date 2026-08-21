import { PlannedAction } from './types';
import { AccessibilityModule } from '../native/AccessibilityModule';

export class VerificationEngine {
  static async verifyStepOutcome(action: PlannedAction): Promise<boolean> {
    if (!action.verificationRule) {
      return true; // No explicit constraint, assume nominal pass
    }

    const currentScreen = await AccessibilityModule.inspectScreen();

    // 1. Verify package match
    if (action.verificationRule.expectedPackage && currentScreen.activePackage !== action.verificationRule.expectedPackage) {
      return false;
    }

    // 2. Verify element presence
    if (action.verificationRule.expectedElementId) {
      const found = currentScreen.nodes.some((n) => n.id === action.verificationRule?.expectedElementId);
      if (!found) return false;
    }

    // 3. Verify text presence
    if (action.verificationRule.expectedTextSnippet) {
      const found = currentScreen.nodes.some((n) =>
        n.text?.toLowerCase().includes(action.verificationRule!.expectedTextSnippet!.toLowerCase()) ||
        n.contentDescription?.toLowerCase().includes(action.verificationRule!.expectedTextSnippet!.toLowerCase())
      );
      if (!found) return false;
    }

    return true;
  }
}
