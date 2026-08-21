import { NativeModules } from 'react-native';
import { NotificationItem } from './types';

const { FridayNotificationNative } = NativeModules;

export class NotificationModule {
  static async isNotificationListenerEnabled(): Promise<boolean> {
    if (FridayNotificationNative?.isEnabled) {
      return await FridayNotificationNative.isEnabled();
    }
    return true;
  }

  static openNotificationListenerSettings(): void {
    if (FridayNotificationNative?.openSettings) {
      FridayNotificationNative.openSettings();
    }
  }

  static async getActiveNotifications(): Promise<NotificationItem[]> {
    if (FridayNotificationNative?.getActiveNotifications) {
      return await FridayNotificationNative.getActiveNotifications();
    }
    return [
      {
        id: 'notif_1',
        packageName: 'com.whatsapp',
        appName: 'WhatsApp',
        title: 'Mom',
        text: 'Please pick up milk on your way home',
        timestamp: Date.now() - 1000 * 60 * 5,
      }
    ];
  }

  static async dismissNotification(id: string): Promise<boolean> {
    if (FridayNotificationNative?.dismissNotification) {
      return await FridayNotificationNative.dismissNotification(id);
    }
    return true;
  }
}
