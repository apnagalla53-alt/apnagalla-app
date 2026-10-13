export interface IntelligenceQuery {
  question: string;
  context?: {
    organizationId?: string;
    branchId?: string;
    userId?: string;
  }
}

export interface IntelligenceResponse {
  intent: string;
  success: boolean;
  answer?: {
    headline: string;
    value: string | number;
    currency?: string;
    summary?: string;
  };
  parameters?: Record<string, any>;
  sources?: any[];
  scope?: {
    organizationId?: string;
    branchId?: string;
  };
  generatedAt: string;
  error?: string;
  missing_dependency?: string;
}

export interface IntentContract {
  intentCode: string;
  displayName: string;
  description: string;
  requiredPermission: string;
  authoritativeDataSource: string;
  handle: (context: IntelligenceContext, parameters: any) => Promise<IntelligenceResponse>;
}

export interface IntelligenceContext {
  organizationId: string;
  branchId?: string;
  userId: string;
}
