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
  icon?: string;
  versionName?: string;
  isSystemApp?: boolean;
}

export interface DeviceStats {
  batteryLevel: number;
  isCharging: boolean;
  totalRamMb: number;
  availRamMb: number;
  totalStorageGb: number;
  freeStorageGb: number;
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
  taskType: 'ALARM' | 'REMINDER' | 'AUTONOMOUS_WORK' | 'ROUTINE';
  targetTimestamp: number;
  title: string;
  payloadJson?: string;
  recurringCron?: string;
  isActive?: boolean;
  createdAt?: number;
  lastExecutedAt?: number;
}

export interface OverlayState {
  statusText: string;
  state: 'LISTENING' | 'THINKING' | 'PLANNING' | 'EXECUTING' | 'VERIFYING' | 'SUCCESS' | 'ERROR' | 'IDLE' | string;
}

export interface ElevatedStatus {
  shizukuAvailable: boolean;
  shizukuPermission: boolean;
  rootAvailable: boolean;
  elevatedAvailable: boolean;
  activeTier: 'SHIZUKU' | 'ROOT' | 'NONE';
}

export interface ElevatedExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}


