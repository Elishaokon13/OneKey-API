import { EventEmitter } from 'events';
import { HttpClient } from './http-client';
import { 
  OneKeyConfig, 
  OneKeyError, 
  ApiResponse,
  KycProvider,
  KycSession,
  KycStatus,
  DocumentType,
  AttestationSchema,
  AttestationRecord,
  CryptoProvider 
} from '../types';

export class OneKeySDK extends EventEmitter {
  private httpClient: HttpClient;
  private config: OneKeyConfig;
  private isInitialized: boolean = false;

  constructor(config: OneKeyConfig) {
    super();
    this.config = this.validateConfig(config);
    this.httpClient = new HttpClient(this.config);
    
    // Forward HTTP client events
    this.httpClient.on('token:refreshed', (token) => {
      this.emit('auth:token:refreshed', token);
    });
    
    this.httpClient.on('token:expired', () => {
      this.emit('auth:token:expired');
    });
    
    this.httpClient.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Initialize the SDK - performs initial authentication and health checks
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Perform health check
      const healthCheck = await this.httpClient.get<{ status: string; timestamp: string }>('/health');
      
      if (healthCheck.status !== 'ok') {
        throw new OneKeyError('SDK_INITIALIZATION_FAILED', 'Service health check failed');
      }

      // If API key is provided, validate it
      if (this.config.apiKey) {
        await this.validateApiKey();
      }

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      const sdkError = error instanceof OneKeyError ? error : 
        new OneKeyError('SDK_INITIALIZATION_FAILED', 'Failed to initialize SDK', error);
      this.emit('error', sdkError);
      throw sdkError;
    }
  }

  /**
   * Authenticate with API key
   */
  async authenticate(apiKey: string): Promise<void> {
    this.config.apiKey = apiKey;
    this.httpClient.updateConfig(this.config);
    
    try {
      await this.validateApiKey();
      this.emit('auth:authenticated');
    } catch (error) {
      const authError = error instanceof OneKeyError ? error :
        new OneKeyError('AUTHENTICATION_FAILED', 'API key authentication failed', error);
      this.emit('auth:failed', authError);
      throw authError;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<OneKeyConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<OneKeyConfig>): void {
    this.config = { ...this.config, ...updates };
    this.httpClient.updateConfig(this.config);
    this.emit('config:updated', this.config);
  }

  /**
   * Check if SDK is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * KYC Methods
   */

  /**
   * Get available KYC providers
   */
  async getKycProviders(): Promise<KycProvider[]> {
    const response = await this.httpClient.get<KycProvider[]>('/kyc/providers');
    return response.data;
  }

  /**
   * Create a new KYC session
   */
  async createKycSession(
    provider: string,
    options: {
      userId?: string;
      metadata?: Record<string, any>;
      webhookUrl?: string;
    } = {}
  ): Promise<KycSession> {
    const response = await this.httpClient.post<KycSession>('/kyc/session', {
      provider,
      ...options
    });
    return response.data;
  }

  /**
   * Get KYC session status
   */
  async getKycSession(sessionId: string): Promise<KycSession> {
    const response = await this.httpClient.get<KycSession>(`/kyc/session/${sessionId}`);
    return response.data;
  }

  /**
   * Upload document for KYC
   */
  async uploadKycDocument(
    sessionId: string,
    documentType: DocumentType,
    file: File | Buffer,
    options: {
      filename?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<{ documentId: string; status: string }> {
    const formData = new FormData();
    formData.append('documentType', documentType);
    formData.append('sessionId', sessionId);
    
    if (file instanceof File) {
      formData.append('document', file, options.filename || file.name);
    } else {
      // Handle Buffer for Node.js environments
      const blob = new Blob([file]);
      formData.append('document', blob, options.filename || 'document');
    }

    if (options.metadata) {
      formData.append('metadata', JSON.stringify(options.metadata));
    }

    const response = await this.httpClient.post<{ documentId: string; status: string }>(
      '/kyc/document/upload',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return response.data;
  }

  /**
   * Get KYC status for a user
   */
  async getKycStatus(userId: string): Promise<KycStatus> {
    const response = await this.httpClient.get<KycStatus>(`/kyc/status/${userId}`);
    return response.data;
  }

  /**
   * Attestation Methods
   */

  /**
   * Get available attestation schemas
   */
  async getAttestationSchemas(): Promise<AttestationSchema[]> {
    const response = await this.httpClient.get<AttestationSchema[]>('/attestations/schemas');
    return response.data;
  }

  /**
   * Create a new attestation
   */
  async createAttestation(
    schemaId: string,
    recipient: string,
    data: Record<string, any>,
    options: {
      expirationTime?: number;
      revocable?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<AttestationRecord> {
    const response = await this.httpClient.post<AttestationRecord>('/attestations', {
      schemaId,
      recipient,
      data,
      ...options
    });
    return response.data;
  }

  /**
   * Get attestation by ID
   */
  async getAttestation(attestationId: string): Promise<AttestationRecord> {
    const response = await this.httpClient.get<AttestationRecord>(`/attestations/${attestationId}`);
    return response.data;
  }

  /**
   * Query attestations
   */
  async queryAttestations(query: {
    recipient?: string;
    schemaId?: string;
    attester?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ attestations: AttestationRecord[]; total: number }> {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined) {
        params.append(key, value.toString());
      }
    });

    const response = await this.httpClient.get<{ attestations: AttestationRecord[]; total: number }>(
      `/attestations/query?${params.toString()}`
    );
    return response.data;
  }

  /**
   * Revoke an attestation
   */
  async revokeAttestation(attestationId: string, reason?: string): Promise<void> {
    await this.httpClient.post(`/attestations/${attestationId}/revoke`, {
      reason
    });
  }

  /**
   * Verify an attestation
   */
  async verifyAttestation(attestationId: string): Promise<{
    valid: boolean;
    issues?: string[];
  }> {
    const response = await this.httpClient.get<{
      valid: boolean;
      issues?: string[];
    }>(`/attestations/${attestationId}/verify`);
    return response.data;
  }

  /**
   * Encryption Methods
   */

  /**
   * Get available crypto providers
   */
  async getCryptoProviders(): Promise<CryptoProvider[]> {
    const response = await this.httpClient.get<CryptoProvider[]>('/crypto/providers');
    return response.data;
  }

  /**
   * Encrypt data
   */
  async encryptData(
    data: string | object,
    options: {
      provider?: string;
      keyId?: string;
      algorithm?: string;
    } = {}
  ): Promise<{
    encrypted: string;
    keyId: string;
    algorithm: string;
    metadata?: Record<string, any>;
  }> {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    
    const response = await this.httpClient.post<{
      encrypted: string;
      keyId: string;
      algorithm: string;
      metadata?: Record<string, any>;
    }>('/crypto/encrypt', {
      data: payload,
      ...options
    });
    
    return response.data;
  }

  /**
   * Decrypt data
   */
  async decryptData(
    encryptedData: string,
    keyId: string,
    options: {
      algorithm?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const response = await this.httpClient.post<{ decrypted: string }>('/crypto/decrypt', {
      encrypted: encryptedData,
      keyId,
      ...options
    });
    
    return response.data.decrypted;
  }

  /**
   * Storage Methods
   */

  /**
   * Store data securely
   */
  async storeData(
    data: string | object,
    options: {
      encrypt?: boolean;
      provider?: string;
      metadata?: Record<string, any>;
      ttl?: number;
    } = {}
  ): Promise<{
    id: string;
    url?: string;
    hash?: string;
    metadata?: Record<string, any>;
  }> {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    
    const response = await this.httpClient.post<{
      id: string;
      url?: string;
      hash?: string;
      metadata?: Record<string, any>;
    }>('/storage/store', {
      data: payload,
      ...options
    });
    
    return response.data;
  }

  /**
   * Retrieve stored data
   */
  async retrieveData(
    id: string,
    options: {
      decrypt?: boolean;
    } = {}
  ): Promise<string> {
    const response = await this.httpClient.get<{ data: string }>(`/storage/retrieve/${id}`, {
      params: options
    });
    
    return response.data.data;
  }

  /**
   * Private helper methods
   */

  private validateConfig(config: OneKeyConfig): OneKeyConfig {
    if (!config.environment) {
      throw new OneKeyError('INVALID_CONFIG', 'Environment is required');
    }

    if (!['production', 'sandbox'].includes(config.environment)) {
      throw new OneKeyError('INVALID_CONFIG', 'Environment must be "production" or "sandbox"');
    }

    return {
      retryAttempts: 3,
      timeout: 30000,
      ...config
    };
  }

  private async validateApiKey(): Promise<void> {
    if (!this.config.apiKey) {
      throw new OneKeyError('AUTHENTICATION_FAILED', 'API key is required');
    }

    try {
      await this.httpClient.get('/auth/validate');
    } catch (error) {
      throw new OneKeyError('AUTHENTICATION_FAILED', 'Invalid API key', error);
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    this.removeAllListeners();
    this.httpClient.destroy();
    this.isInitialized = false;
  }
}

// Export default instance creator
export function createOneKeySDK(config: OneKeyConfig): OneKeySDK {
  return new OneKeySDK(config);
} 