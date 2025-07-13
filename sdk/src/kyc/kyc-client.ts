import { HttpClient } from '../core/http-client';
import { 
  OneKeyConfig, 
  OneKeyError,
  KycProvider, 
  KycSession, 
  KycStatus,
  DocumentType,
  KycDocument,
  KycWebhookEvent 
} from '../types';
import { EventEmitter } from 'events';

export class KycClient extends EventEmitter {
  private httpClient: HttpClient;

  constructor(config: OneKeyConfig) {
    super();
    this.httpClient = new HttpClient(config);
    
    // Forward HTTP client events
    this.httpClient.on('token:refreshed', (token) => {
      this.emit('token:refreshed', token);
    });
    
    this.httpClient.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Get all available KYC providers
   */
  async getProviders(): Promise<KycProvider[]> {
    try {
      const response = await this.httpClient.get<KycProvider[]>('/kyc/providers');
      if (!response.data) {
        throw new OneKeyError('KYC_PROVIDERS_FETCH_FAILED', 'No data received from KYC providers endpoint');
      }
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_PROVIDERS_FETCH_FAILED', 'Failed to fetch KYC providers', error as any);
    }
  }

  /**
   * Get a specific KYC provider by ID
   */
  async getProvider(providerId: string): Promise<KycProvider> {
    try {
      const response = await this.httpClient.get<KycProvider>(`/kyc/providers/${providerId}`);
      if (!response.data) {
        throw new OneKeyError('KYC_PROVIDER_FETCH_FAILED', `No data received for KYC provider ${providerId}`);
      }
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_PROVIDER_FETCH_FAILED', `Failed to fetch KYC provider ${providerId}`, error as any);
    }
  }

  /**
   * Create a new KYC session
   */
  async createSession(
    providerId: string,
    options: {
      userId?: string;
      userEmail?: string;
      userPhone?: string;
      metadata?: Record<string, any>;
      webhookUrl?: string;
      returnUrl?: string;
      expiresAt?: Date;
      configuration?: Record<string, any>;
    } = {}
  ): Promise<KycSession> {
    try {
      const payload = {
        providerId,
        userId: options.userId,
        userEmail: options.userEmail,
        userPhone: options.userPhone,
        metadata: options.metadata,
        webhookUrl: options.webhookUrl,
        returnUrl: options.returnUrl,
        expiresAt: options.expiresAt?.toISOString(),
        configuration: options.configuration
      };

      const response = await this.httpClient.post<KycSession>('/kyc/sessions', payload);
      if (!response.data) {
        throw new OneKeyError('KYC_SESSION_CREATE_FAILED', 'No data received from session creation');
      }
      this.emit('session:created', response.data);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_SESSION_CREATE_FAILED', 'Failed to create KYC session', error as any);
    }
  }

  /**
   * Get KYC session by ID
   */
  async getSession(sessionId: string): Promise<KycSession> {
    try {
      const response = await this.httpClient.get<KycSession>(`/kyc/sessions/${sessionId}`);
      if (!response.data) {
        throw new OneKeyError('KYC_SESSION_FETCH_FAILED', `No data received for session ${sessionId}`);
      }
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_SESSION_FETCH_FAILED', `Failed to fetch KYC session ${sessionId}`, error as any);
    }
  }

  /**
   * Update KYC session
   */
  async updateSession(
    sessionId: string,
    updates: {
      metadata?: Record<string, any>;
      webhookUrl?: string;
      returnUrl?: string;
      expiresAt?: Date;
      configuration?: Record<string, any>;
    }
  ): Promise<KycSession> {
    try {
      const payload = {
        ...updates,
        expiresAt: updates.expiresAt?.toISOString()
      };

      const response = await this.httpClient.patch<KycSession>(`/kyc/sessions/${sessionId}`, payload);
      if (!response.data) {
        throw new OneKeyError('KYC_SESSION_UPDATE_FAILED', `No data received for session update ${sessionId}`);
      }
      this.emit('session:updated', response.data);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_SESSION_UPDATE_FAILED', `Failed to update KYC session ${sessionId}`, error as any);
    }
  }

  /**
   * Cancel KYC session
   */
  async cancelSession(sessionId: string, reason?: string): Promise<void> {
    try {
      await this.httpClient.post(`/kyc/sessions/${sessionId}/cancel`, { reason });
      this.emit('session:cancelled', { sessionId, reason });
    } catch (error) {
      throw new OneKeyError('KYC_SESSION_CANCEL_FAILED', `Failed to cancel KYC session ${sessionId}`, error as any);
    }
  }

  /**
   * Upload document for KYC verification
   */
  async uploadDocument(
    sessionId: string,
    documentType: DocumentType,
    file: File | Buffer,
    options: {
      filename?: string;
      mimeType?: string;
      metadata?: Record<string, any>;
      side?: 'front' | 'back';
    } = {}
  ): Promise<KycDocument> {
    try {
      const formData = new FormData();
      formData.append('sessionId', sessionId);
      formData.append('documentType', documentType);
      
      if (options.side) {
        formData.append('side', options.side);
      }

      if (file instanceof File) {
        formData.append('document', file, options.filename || file.name);
      } else {
        // Handle Buffer for Node.js environments
        const blob = new Blob([file], { type: options.mimeType || 'application/octet-stream' });
        formData.append('document', blob, options.filename || 'document');
      }

      if (options.metadata) {
        formData.append('metadata', JSON.stringify(options.metadata));
      }

      const response = await this.httpClient.post<KycDocument>(
        '/kyc/documents',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      this.emit('document:uploaded', response.data);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_DOCUMENT_UPLOAD_FAILED', 'Failed to upload KYC document', error);
    }
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<KycDocument> {
    try {
      const response = await this.httpClient.get<KycDocument>(`/kyc/documents/${documentId}`);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_DOCUMENT_FETCH_FAILED', `Failed to fetch KYC document ${documentId}`, error);
    }
  }

  /**
   * Get all documents for a session
   */
  async getSessionDocuments(sessionId: string): Promise<KycDocument[]> {
    try {
      const response = await this.httpClient.get<KycDocument[]>(`/kyc/sessions/${sessionId}/documents`);
      if (!response.data) {
        throw new OneKeyError('KYC_DOCUMENTS_FETCH_FAILED', `No data received for session ${sessionId} documents`);
      }
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_DOCUMENTS_FETCH_FAILED', `Failed to fetch documents for session ${sessionId}`, error as any);
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      await this.httpClient.delete(`/kyc/documents/${documentId}`);
      this.emit('document:deleted', { documentId });
    } catch (error) {
      throw new OneKeyError('KYC_DOCUMENT_DELETE_FAILED', `Failed to delete KYC document ${documentId}`, error);
    }
  }

  /**
   * Get KYC status for a user
   */
  async getStatus(userId: string): Promise<KycStatus> {
    try {
      const response = await this.httpClient.get<KycStatus>(`/kyc/status/${userId}`);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_STATUS_FETCH_FAILED', `Failed to fetch KYC status for user ${userId}`, error);
    }
  }

  /**
   * Submit KYC session for review
   */
  async submitSession(sessionId: string): Promise<KycSession> {
    try {
      const response = await this.httpClient.post<KycSession>(`/kyc/sessions/${sessionId}/submit`);
      this.emit('session:submitted', response.data);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_SESSION_SUBMIT_FAILED', `Failed to submit KYC session ${sessionId}`, error);
    }
  }

  /**
   * Get session verification result
   */
  async getVerificationResult(sessionId: string): Promise<{
    status: 'pending' | 'approved' | 'rejected' | 'requires_review';
    score?: number;
    reasons?: string[];
    details?: Record<string, any>;
    completedAt?: string;
  }> {
    try {
      const response = await this.httpClient.get<{
        status: 'pending' | 'approved' | 'rejected' | 'requires_review';
        score?: number;
        reasons?: string[];
        details?: Record<string, any>;
        completedAt?: string;
      }>(`/kyc/sessions/${sessionId}/result`);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_RESULT_FETCH_FAILED', `Failed to fetch verification result for session ${sessionId}`, error);
    }
  }

  /**
   * Handle webhook events
   */
  async handleWebhook(payload: KycWebhookEvent): Promise<void> {
    try {
      // Validate webhook signature if needed
      await this.validateWebhook(payload);
      
      // Emit event based on webhook type
      switch (payload.event) {
        case 'session.created':
          this.emit('session:created', payload.data);
          break;
        case 'session.updated':
          this.emit('session:updated', payload.data);
          break;
        case 'session.completed':
          this.emit('session:completed', payload.data);
          break;
        case 'session.failed':
          this.emit('session:failed', payload.data);
          break;
        case 'document.uploaded':
          this.emit('document:uploaded', payload.data);
          break;
        case 'document.processed':
          this.emit('document:processed', payload.data);
          break;
        case 'verification.completed':
          this.emit('verification:completed', payload.data);
          break;
        default:
          this.emit('webhook:unknown', payload);
      }
    } catch (error) {
      throw new OneKeyError('KYC_WEBHOOK_HANDLE_FAILED', 'Failed to handle KYC webhook', error);
    }
  }

  /**
   * List user's KYC sessions
   */
  async listUserSessions(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: string;
      provider?: string;
    } = {}
  ): Promise<{ sessions: KycSession[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());
      if (options.status) params.append('status', options.status);
      if (options.provider) params.append('provider', options.provider);

      const response = await this.httpClient.get<{ sessions: KycSession[]; total: number }>(
        `/kyc/users/${userId}/sessions?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_SESSIONS_FETCH_FAILED', `Failed to fetch sessions for user ${userId}`, error);
    }
  }

  /**
   * Get KYC statistics
   */
  async getStatistics(options: {
    startDate?: Date;
    endDate?: Date;
    provider?: string;
  } = {}): Promise<{
    totalSessions: number;
    completedSessions: number;
    approvedSessions: number;
    rejectedSessions: number;
    averageCompletionTime: number;
    successRate: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (options.startDate) params.append('startDate', options.startDate.toISOString());
      if (options.endDate) params.append('endDate', options.endDate.toISOString());
      if (options.provider) params.append('provider', options.provider);

      const response = await this.httpClient.get<{
        totalSessions: number;
        completedSessions: number;
        approvedSessions: number;
        rejectedSessions: number;
        averageCompletionTime: number;
        successRate: number;
      }>(`/kyc/statistics?${params.toString()}`);
      return response.data;
    } catch (error) {
      throw new OneKeyError('KYC_STATISTICS_FETCH_FAILED', 'Failed to fetch KYC statistics', error);
    }
  }

  /**
   * Update configuration for all HTTP requests
   */
  updateConfig(config: Partial<OneKeyConfig>): void {
    this.httpClient.updateConfig(config);
  }

  /**
   * Private helper methods
   */
  private async validateWebhook(payload: KycWebhookEvent): Promise<void> {
    // Webhook signature validation would go here
    // This is a placeholder for actual webhook validation logic
    if (!payload.event || !payload.data) {
      throw new OneKeyError('INVALID_WEBHOOK', 'Invalid webhook payload');
    }
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    this.removeAllListeners();
  }
}

// Helper function to create KYC client
export function createKycClient(config: OneKeyConfig): KycClient {
  return new KycClient(config);
} 