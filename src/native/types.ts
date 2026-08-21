export interface UINode {
  id: string;
  className: string;
  text?: string;
  contentDescription?: string;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    centerX: number;
    centerY: number;
    width: number;
    height: number;
  };
  isClickable: boolean;
  isEditable: boolean;
  isScrollable: boolean;
  isVisible: boolean;
  packageName: string;
}

export interface ScreenTree {
  activePackage: string;
  activeActivity?: string;
  nodes: UINode[];
  timestamp: number;
  screenWidth: number;
  screenHeight: number;
}

export interface BatteryStatus {
  level: number;
  isCharging: boolean;
  batteryHealth?: string;
}

export interface InstalledApp {
  appName: string;
  packageName: string;
  versionName?: string;
  isSystemApp?: boolean;
}

export interface NotificationItem {
  id: string;
  packageName: string;
  appName: string;
  title: string;
  text: string;
  timestamp: number;
}

export interface ScheduledTask {
  id: string;
  taskType: 'ALARM' | 'REMINDER' | 'AUTONOMOUS_WORK';
  targetTimestamp: number;
  title: string;
  payloadJson?: string;
  recurringCron?: string;
}
