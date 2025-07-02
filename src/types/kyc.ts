// OneKey KYC API - KYC Types
// Comprehensive interfaces for multi-provider KYC verification

// ===== Core KYC Interfaces =====

export interface KycUser {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  dateOfBirth?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country: string;
  };
  metadata?: Record<string, any>;
}

export interface KycDocument {
  type: 'passport' | 'drivers_license' | 'national_id' | 'residence_permit' | 'voter_id';
  country: string;
  frontImageBase64?: string;
  backImageBase64?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  number?: string;
  expirationDate?: string;
  issueDate?: string;
  metadata?: Record<string, any>;
}

export interface KycBiometric {
  type: 'selfie' | 'liveness_video' | 'face_comparison';
  imageBase64?: string;
  videoBase64?: string;
  imageUrl?: string;
  videoUrl?: string;
  metadata?: Record<string, any>;
}

// ===== Provider-Specific Interfaces =====

export interface SmileIdentityRequest {
  partnerParams: {
    user_id: string;
    job_id: string;
    job_type: number;
  };
  images: Array<{
    image_type_id: number;
    image: string; // base64
  }>;
  id_info: {
    first_name: string;
    last_name: string;
    middle_name?: string;
    dob?: string;
    phone_number?: string;
    entered: boolean;
  };
  options: {
    return_job_status: boolean;
    return_history: boolean;
    return_image_links: boolean;
  };
}

export interface OnfidoRequest {
  first_name: string;
  last_name: string;
  dob?: string;
  address?: {
    flat_number?: string;
    building_number?: string;
    building_name?: string;
    street?: string;
    sub_street?: string;
    town?: string;
    state?: string;
    postcode?: string;
    country: string;
  };
}

export interface TruliooRequest {
  Record: {
    RecordID: string;
    RecordStatus: string;
    DatasourceResults: Array<{
      DatasourceName: string;
      DatasourceFields: Array<{
        FieldName: string;
        Status: string;
      }>;
    }>;
    CountryCode: string;
    ProductName: string;
    PersonInfo: {
      FirstGivenName: string;
      FirstSurName: string;
      MiddleName?: string;
      DayOfBirth?: number;
      MonthOfBirth?: number;
      YearOfBirth?: number;
    };
    LocationInfo?: {
      BuildingNumber?: string;
      UnitNumber?: string;
      StreetName?: string;
      StreetType?: string;
      City?: string;
      Suburb?: string;
      StateProvinceCode?: string;
      PostalCode?: string;
      CountryCode: string;
    };
    Communication?: {
      EmailAddress?: string;
      Telephone?: string;
      MobileNumber?: string;
    };
    NationalIds?: Array<{
      Number: string;
      Type: string;
    }>;
  };
}

// ===== Verification Results =====

export interface KycVerificationResult {
  sessionId: string;
  provider: KycProvider;
  status: KycStatus;
  confidence: number; // 0-100
  user: KycUser;
  document?: {
    type: string;
    verified: boolean;
    extractedData: Record<string, any>;
    confidence: number;
  };
  biometric?: {
    type: string;
    verified: boolean;
    confidence: number;
    livenessScore?: number;
  };
  checks: {
    documentAuthenticity: KycCheckResult;
    faceMatch: KycCheckResult;
    addressVerification: KycCheckResult;
    identityVerification: KycCheckResult;
    livenessDetection: KycCheckResult;
    sanctions?: KycCheckResult;
    pep?: KycCheckResult;
  };
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    score: number; // 0-100
    reasons: string[];
  };
  providerResponse: {
    rawResponse: Record<string, any>;
    providerSessionId: string;
    providerStatus: string;
    timestamp: string;
  };
  metadata: {
    processingTime: number;
    ipAddress?: string;
    userAgent?: string;
    location?: {
      country: string;
      region?: string;
      city?: string;
    };
  };
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
}

export interface KycCheckResult {
  status: 'pass' | 'fail' | 'partial' | 'pending' | 'not_applicable';
  confidence: number;
  details?: string;
  reasons?: string[];
}

// ===== Session Management =====

export interface KycSession {
  id: string;
  userId: string;
  sessionId: string;
  provider: KycProvider;
  status: KycStatus;
  countryCode?: string;
  documentType?: string;
  verificationResult?: KycVerificationResult;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  expiresAt?: string;
  metadata: Record<string, any>;
}

export interface CreateKycSessionRequest {
  provider: KycProvider;
  user: KycUser;
  document?: KycDocument;
  biometric?: KycBiometric;
  options?: {
    skipBiometricVerification?: boolean;
    skipDocumentVerification?: boolean;
    enableLivenessDetection?: boolean;
    returnProviderResponse?: boolean;
    webhookUrl?: string;
  };
  metadata?: Record<string, any>;
}

export interface UpdateKycSessionRequest {
  status?: KycStatus;
  document?: KycDocument;
  biometric?: KycBiometric;
  metadata?: Record<string, any>;
}

// ===== Provider Configuration =====

export interface KycProviderConfig {
  provider: KycProvider;
  enabled: boolean;
  priority: number; // 1 = highest priority
  config: {
    apiKey: string;
    apiSecret?: string;
    baseUrl?: string;
    webhookSecret?: string;
    testMode?: boolean;
  };
  capabilities: {
    documentVerification: boolean;
    biometricVerification: boolean;
    livenessDetection: boolean;
    addressVerification: boolean;
    sanctionsScreening: boolean;
    pepScreening: boolean;
  };
  supportedCountries: string[];
  supportedDocuments: string[];
  metadata?: Record<string, any>;
}

// ===== Webhook & Events =====

export interface KycWebhookPayload {
  eventType: 'session_created' | 'verification_completed' | 'verification_failed' | 'session_expired';
  sessionId: string;
  userId: string;
  provider: KycProvider;
  status: KycStatus;
  timestamp: string;
  data: Record<string, any>;
  signature: string;
}

// ===== Enums =====

export type KycProvider = 'smile_identity' | 'onfido' | 'trulioo';

export type KycStatus = 
  | 'pending'          // Session created, waiting for documents
  | 'documents_uploaded' // Documents received, processing
  | 'processing'       // Active verification in progress
  | 'completed'        // Verification successful
  | 'failed'          // Verification failed
  | 'expired'         // Session expired before completion
  | 'cancelled'       // User or system cancelled
  | 'requires_manual_review' // Flagged for manual review
  | 'under_review';   // Currently under manual review

// ===== Error Classes =====

export class KycError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: KycProvider,
    public sessionId?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'KycError';
  }
}

export class KycProviderError extends KycError {
  constructor(
    message: string,
    public provider: KycProvider,
    public providerCode?: string,
    public providerMessage?: string,
    sessionId?: string
  ) {
    super(message, 'KYC_PROVIDER_ERROR', provider, sessionId, {
      providerCode,
      providerMessage
    });
    this.name = 'KycProviderError';
  }
}

export class KycValidationError extends KycError {
  constructor(
    message: string,
    public field: string,
    public value?: any,
    sessionId?: string
  ) {
    super(message, 'KYC_VALIDATION_ERROR', undefined, sessionId, {
      field,
      value
    });
    this.name = 'KycValidationError';
  }
}

export class KycSessionNotFoundError extends KycError {
  constructor(sessionId: string) {
    super(`KYC session not found: ${sessionId}`, 'KYC_SESSION_NOT_FOUND', undefined, sessionId);
    this.name = 'KycSessionNotFoundError';
  }
}

export class KycProviderUnavailableError extends KycError {
  constructor(provider: KycProvider, reason?: string) {
    super(
      `KYC provider ${provider} is currently unavailable${reason ? `: ${reason}` : ''}`,
      'KYC_PROVIDER_UNAVAILABLE',
      provider
    );
    this.name = 'KycProviderUnavailableError';
  }
}

// ===== Response Types =====

export interface KycApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  requestId: string;
  timestamp: string;
}

export interface KycSessionResponse extends KycApiResponse<KycSession> {}
export interface KycVerificationResponse extends KycApiResponse<KycVerificationResult> {}
export interface KycProvidersResponse extends KycApiResponse<KycProviderConfig[]> {}
export interface KycSessionListResponse extends KycApiResponse<{
  sessions: KycSession[];
  total: number;
  page: number;
  limit: number;
}> {}

// ===== Provider-Specific Result Types =====

export interface SmileIdentityResult {
  JobSuccess: boolean;
  JobComplete: boolean;
  Code: string;
  ResultText: string;
  ResultType: string;
  PartnerParams: {
    user_id: string;
    job_id: string;
    job_type: number;
  };
  ConfidenceValue: number;
  Actions: {
    Verify_ID_Number: string;
    Return_Personal_Info: string;
    Human_Review_Compare: string;
    Human_Review_Liveness_Check: string;
    Liveness_Check: string;
    Register_Selfie: string;
    Update_Registered_Selfie_On_File: string;
  };
  Result: {
    DOBCheck: string;
    Document: any;
    ExpirationCheck: string;
    FullNameCheck: string;
    IDNumberCheck: string;
    PersonalInfoCheck: string;
    PhoneNumberCheck: string;
    PhotoCheck: string;
    SmileJobID: string;
  };
  ImageLinks: {
    selfie_image: string;
    liveness_image: string;
  };
  History: any[];
  timestamp: string;
}

export interface OnfidoResult {
  id: string;
  created_at: string;
  status: string;
  result: string;
  sub_result: string;
  check_id: string;
  document_id: string;
  form_uri: string;
  redirect_uri: string;
  results_uri: string;
  mobile_url: string;
  desktop_url: string;
  download_uri: string;
  welcome_url: string;
  report_names: string[];
  tags: string[];
  applicant_provides_data: boolean;
}

export interface TruliooResult {
  TransactionID: string;
  TransactionRecordID: string;
  CountryCode: string;
  ProductName: string;
  Record: {
    TransactionRecordID: string;
    RecordStatus: string;
    DatasourceResults: Array<{
      DatasourceName: string;
      DatasourceFields: Array<{
        FieldName: string;
        Status: string;
      }>;
      AppendedFields: Array<{
        FieldName: string;
        Data: string;
      }>;
    }>;
    Errors: Array<{
      Code: string;
      Message: string;
    }>;
  };
} 