import { PlannedAction } from './types';
import { ExecutionEngine } from './executor';
import { Logger } from '../utils/logger';

export class RecoveryManager {
  static async attemptRecovery(failedAction: PlannedAction, retryCount: number): Promise<boolean> {
    if (retryCount >= 3) {
      Logger.warn(`Max retries reached for step: ${failedAction.description}`);
      return false;
    }

    Logger.info(`Attempting recovery for step (attempt ${retryCount + 1}): ${failedAction.description}`);
    
    // Short settle delay
    await new Promise((r) => setTimeout(r, 250));

    // Retry execution
    const retryResult = await ExecutionEngine.executeStep(failedAction);
    return retryResult.success;
  }
}
