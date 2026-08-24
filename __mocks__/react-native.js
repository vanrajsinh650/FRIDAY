const listeners = {};

const DeviceEventEmitter = {
  addListener: jest.fn((event, callback) => {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(callback);
    return {
      remove: jest.fn(() => {
        listeners[event] = (listeners[event] || []).filter((cb) => cb !== callback);
      }),
    };
  }),
  emit: jest.fn((event, ...args) => {
    (listeners[event] || []).forEach((cb) => cb(...args));
  }),
  removeAllListeners: jest.fn((event) => {
    if (event) {
      delete listeners[event];
    } else {
      Object.keys(listeners).forEach((k) => delete listeners[k]);
    }
  }),
};

module.exports = {
  Platform: {
    OS: 'android',
    select: (obj) => obj.android || obj.default,
  },
  DeviceEventEmitter,
  NativeModules: {
    FridayAccessibilityNative: {},
    FridayVoiceInteractionNative: {},
    FridaySystemControlNative: {},
    FridayNotificationNative: {},
    FridayScreenCaptureNative: {},
    FridaySchedulerNative: {},
    FridayFloatingOverlayNative: {},
    FridayRootControlNative: {},
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
