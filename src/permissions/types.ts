export type PermissionStatus = 'GRANTED' | 'DENIED' | 'BLOCKED' | 'SPECIAL_ACCESS_REQUIRED';

export interface PermissionCheckResult {
  permission: string;
  status: PermissionStatus;
  userFacingExplanation: string;
  isSpecialAccess: boolean;
}
