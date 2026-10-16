export interface UserProfile {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  disabled?: boolean;
  externalUserId?: string;
  hasCredentials: boolean;
  credentialHeaderOverride?: string;
  createdAt?: string;
}

export interface CustomHeaderConfig {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface SuccessRuleConfig {
  type: 'status_code' | 'json_match';
  minStatus?: number;
  maxStatus?: number;
  jsonPath?: string;
  expectedValue?: string;
}

export interface ConnectionConfig {
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH';
  authMode: 'bearer' | 'header' | 'none';
  authHeaderName: string;
  hasGlobalSecret: boolean;
  contentType: 'application/json' | 'application/x-www-form-urlencoded';
  qrFieldName: string;
  qrNestingPath: string;
  externalUserIdField: string;
  staticFieldsJson: string;
  successRule: SuccessRuleConfig;
  customHeaders: CustomHeaderConfig[];
}

export interface ScannerConfigStatus {
  isEndpointConfigured: boolean;
  hasUserCredentials: boolean;
  hasGlobalCredentials: boolean;
  isAuthSatisfied: boolean;
  authMode: 'bearer' | 'header' | 'none';
  endpointHost: string | null;
  employeeName: string;
  externalUserId: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  username: string;
  status: 'success' | 'failure' | 'timeout';
  statusCode?: number;
  responseSummary: string;
}

export interface SendResult {
  success: boolean;
  statusCode?: number;
  message?: string;
  error?: string;
  timeout?: boolean;
  responseExcerpt?: string;
  timestamp?: string;
}
