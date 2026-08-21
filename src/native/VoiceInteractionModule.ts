import { NativeModules } from 'react-native';

const { FridayVoiceInteractionNative } = NativeModules;

export class VoiceInteractionModule {
  static async isDefaultAssistant(): Promise<boolean> {
    if (FridayVoiceInteractionNative?.isDefaultAssistant) {
      return await FridayVoiceInteractionNative.isDefaultAssistant();
    }
    return true;
  }

  static requestAssistantRole(): void {
    if (FridayVoiceInteractionNative?.requestAssistantRole) {
      FridayVoiceInteractionNative.requestAssistantRole();
    }
  }

  static async startVoiceSession(): Promise<boolean> {
    if (FridayVoiceInteractionNative?.startVoiceSession) {
      return await FridayVoiceInteractionNative.startVoiceSession();
    }
    return true;
  }

  static async stopVoiceSession(): Promise<void> {
    if (FridayVoiceInteractionNative?.stopVoiceSession) {
      await FridayVoiceInteractionNative.stopVoiceSession();
    }
  }
}
