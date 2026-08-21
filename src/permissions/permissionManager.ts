import { PermissionsAndroid, Platform } from 'react-native';
import { AccessibilityModule } from '../native/AccessibilityModule';
import { VoiceInteractionModule } from '../native/VoiceInteractionModule';
import { NotificationModule } from '../native/NotificationModule';
import { PermissionCheckResult } from './types';

export class PermissionManager {
  static async checkAllPermissions(): Promise<PermissionCheckResult[]> {
    const results: PermissionCheckResult[] = [];

    // 1. Accessibility Service
    const accessibilityEnabled = await AccessibilityModule.isServiceEnabled();
    results.push({
      permission: 'android.permission.BIND_ACCESSIBILITY_SERVICE',
      status: accessibilityEnabled ? 'GRANTED' : 'SPECIAL_ACCESS_REQUIRED',
      userFacingExplanation: 'Required to read screen elements, tap buttons, and operate phone apps for you.',
      isSpecialAccess: true,
    });

    // 2. Default Assistant
    const isAssistant = await VoiceInteractionModule.isDefaultAssistant();
    results.push({
      permission: 'android.permission.BIND_VOICE_INTERACTION_SERVICE',
      status: isAssistant ? 'GRANTED' : 'SPECIAL_ACCESS_REQUIRED',
      userFacingExplanation: 'Allows FRIDAY to be your default voice assistant over the lock screen and home button.',
      isSpecialAccess: true,
    });

    // 3. Microphone
    const micGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    results.push({
      permission: PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      status: micGranted ? 'GRANTED' : 'DENIED',
      userFacingExplanation: 'Required for wake word detection and understanding your voice commands.',
      isSpecialAccess: false,
    });

    // 4. Notifications
    const notifGranted = await NotificationModule.isNotificationListenerEnabled();
    results.push({
      permission: 'android.permission.BIND_NOTIFICATION_LISTENER_SERVICE',
      status: notifGranted ? 'GRANTED' : 'SPECIAL_ACCESS_REQUIRED',
      userFacingExplanation: 'Enables FRIDAY to read incoming messages and summarize alerts.',
      isSpecialAccess: true,
    });

    return results;
  }

  static async requestMicrophonePermission(): Promise<boolean> {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'FRIDAY Microphone Access',
          message: 'FRIDAY needs access to your microphone to listen to voice commands.',
          buttonPositive: 'Grant Access',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
}
