export type PrivilegeLevel = 'NORMAL' | 'ASSISTANT' | 'ACCESSIBILITY' | 'DEVICE_OWNER' | 'ROOT';

export interface DeviceState {
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: string;
  volume: {
    media: number;
    alarm: number;
    ring: number;
  };
  brightness: number;
  isTorchOn: boolean;
  storage: {
    freeBytes: number;
    totalBytes: number;
    usedPercentage: number;
  };
  ram: {
    freeMb: number;
    totalMb: number;
  };
}

export interface ForegroundState {
  packageName: string;
  activityName?: string;
  appLabel?: string;
  surfaceCategory: 'SYSTEM_UI' | 'LAUNCHER' | 'APP' | 'SETTINGS' | 'KEYGUARD' | 'OVERLAY' | 'UNKNOWN';
  windowTitle?: string;
}

export interface ScreenState {
  isScreenOn: boolean;
  isLocked: boolean;
  orientation: 'PORTRAIT' | 'LANDSCAPE';
  focusedElementText?: string;
  interactiveElementsCount: number;
  scrollableElementsCount: number;
  treeSummary: string;
}

export interface AudioState {
  isMediaPlaying: boolean;
  isMicActive: boolean;
  isFridaySpeaking: boolean;
}

export interface NotificationItem {
  id: string;
  packageName: string;
  appName?: string;
  title: string;
  text: string;
  postTime: number;
  category?: string;
}

export interface NotificationState {
  activeCount: number;
  recentNotifications: NotificationItem[];
}

export interface NetworkState {
  isConnected: boolean;
  type: 'WIFI' | 'CELLULAR' | 'ETHERNET' | 'NONE';
  isInternetReachable: boolean;
}

export interface LocationState {
  timezone: string;
  locale: string;
}

export interface CalendarState {
  currentTime: string;
  currentDate: string;
  dayOfWeek: string;
  activeRemindersCount: number;
  upcomingReminders: string[];
}

export interface PermissionState {
  accessibilityGranted: boolean;
  notificationListenerGranted: boolean;
  overlayGranted: boolean;
  audioRecordGranted: boolean;
  installPackagesGranted: boolean;
  isDefaultLauncher: boolean;
  isDefaultAssistant: boolean;
}

export interface WorldState {
  device: DeviceState;
  foreground: ForegroundState;
  screen: ScreenState;
  audio: AudioState;
  notifications: NotificationState;
  network: NetworkState;
  location: LocationState;
  calendar: CalendarState;
  permissions: PermissionState;
  privilegeLevel: PrivilegeLevel;
  timestamp: number;
}
