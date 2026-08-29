export type CapabilityCategory =
  | 'OBSERVATION'
  | 'INTERACTION'
  | 'SYSTEM'
  | 'COMMUNICATION'
  | 'SCHEDULING'
  | 'COGNITION'
  | 'PERCEPTION'
  | 'PRIVILEGED';

export type CapabilityStatus =
  | 'AVAILABLE'
  | 'UNAVAILABLE'
  | 'PERMISSION_REQUIRED'
  | 'CONFIRMATION_REQUIRED'
  | 'RESTRICTED';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Capability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  status: CapabilityStatus;
  riskLevel: RiskLevel;
  requiredPermission?: string;
  parametersSchema: Record<string, any>;
  execute: (params: any, context?: any) => Promise<any>;
}

export interface CapabilitySnapshot {
  timestamp: number;
  availableCapabilities: Capability[];
  unavailableCount: number;
  highestPrivilege: string;
}
