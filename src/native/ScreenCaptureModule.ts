import { NativeModules } from 'react-native';

const { FridayScreenCaptureNative } = NativeModules;

export class ScreenCaptureModule {
  static async captureScreenshot(options?: { quality?: number; maxWidth?: number }): Promise<{ base64: string; width: number; height: number }> {
    if (FridayScreenCaptureNative?.captureScreenshot) {
      return await FridayScreenCaptureNative.captureScreenshot(options?.quality || 70, options?.maxWidth || 720);
    }
    // Return placeholder 1x1 png in dev environment
    return {
      base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      width: 720,
      height: 1600,
    };
  }
}
