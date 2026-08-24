import { VisionPerception } from './perception/visionPerception';
import { Logger } from '../utils/logger';

export class VisionFallbackManager {
  static async executeVisualAction(goalDescription: string, preferElevated: boolean = false): Promise<boolean> {
    if (!goalDescription || typeof goalDescription !== 'string' || goalDescription.trim().length === 0) {
      Logger.warn('VisionFallbackManager: empty or invalid goalDescription provided');
      return false;
    }

    Logger.info(`Triggering Vision Fallback for: ${goalDescription}`);
    try {
      const result = await VisionPerception.executeVisualTap(goalDescription.trim(), preferElevated);
      return result.success;
    } catch (err: any) {
      Logger.warn(`VisionFallbackManager failed for "${goalDescription}"`, err?.message || err);
      return false;
    }
  }
}
