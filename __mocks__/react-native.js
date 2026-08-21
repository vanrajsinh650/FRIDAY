module.exports = {
  Platform: {
    OS: 'android',
    select: (obj) => obj.android || obj.default,
  },
  NativeModules: {
    FridayAccessibilityNative: {},
    FridayVoiceInteractionNative: {},
    FridaySystemControlNative: {},
    FridayNotificationNative: {},
    FridayScreenCaptureNative: {},
    FridaySchedulerNative: {},
  },
  PermissionsAndroid: {
    PERMISSIONS: {
      RECORD_AUDIO: 'android.permission.RECORD_AUDIO',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    check: jest.fn().mockResolvedValue(true),
    request: jest.fn().mockResolvedValue('granted'),
  },
  StyleSheet: {
    create: (styles) => styles,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  AppRegistry: {
    registerComponent: jest.fn(),
  },
};
