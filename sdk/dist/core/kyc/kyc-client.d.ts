import { OneKeyConfig, KycProvider, KycSession, KycStatus, DocumentType, KycDocument, KycWebhookEvent } from '../types';
import { EventEmitter } from 'events';
export declare class KycClient extends EventEmitter {
    private httpClient;
    constructor(config: OneKeyConfig);
    /**
     * Get all available KYC providers
     */
    getProviders(): Promise<KycProvider[]>;
    /**
     * Get a specific KYC provider by ID
     */
    getProvider(providerId: string): Promise<KycProvider>;
    /**
     * Create a new KYC session
     */
    createSession(providerId: string, options?: {
        userId?: string;
        userEmail?: string;
        userPhone?: string;
        metadata?: Record<string, any>;
        webhookUrl?: string;
        returnUrl?: string;
        expiresAt?: Date;
        configuration?: Record<string, any>;
    }): Promise<KycSession>;
    /**
     * Get KYC session by ID
     */
    getSession(sessionId: string): Promise<KycSession>;
    /**
     * Update KYC session
     */
    updateSession(sessionId: string, updates: {
        metadata?: Record<string, any>;
        webhookUrl?: string;
        returnUrl?: string;
        expiresAt?: Date;
        configuration?: Record<string, any>;
    }): Promise<KycSession>;
    /**
     * Cancel KYC session
     */
    cancelSession(sessionId: string, reason?: string): Promise<void>;
    /**
     * Upload document for KYC verification
     */
    uploadDocument(sessionId: string, documentType: DocumentType, file: File | Buffer, options?: {
        filename?: string;
        mimeType?: string;
        metadata?: Record<string, any>;
        side?: 'front' | 'back';
    }): Promise<KycDocument>;
    /**
     * Get document by ID
     */
    getDocument(documentId: string): Promise<KycDocument>;
    /**
     * Get all documents for a session
     */
    getSessionDocuments(sessionId: string): Promise<KycDocument[]>;
    /**
     * Delete document
     */
    deleteDocument(documentId: string): Promise<void>;
    /**
     * Get KYC status for a user
     */
    getStatus(userId: string): Promise<KycStatus>;
    /**
     * Submit KYC session for review
     */
    submitSession(sessionId: string): Promise<KycSession>;
    /**
     * Get session verification result
     */
    getVerificationResult(sessionId: string): Promise<{
        status: 'pending' | 'approved' | 'rejected' | 'requires_review';
        score?: number;
        reasons?: string[];
        details?: Record<string, any>;
        completedAt?: string;
    }>;
    /**
     * Handle webhook events
     */
    handleWebhook(payload: KycWebhookEvent): Promise<void>;
    /**
     * List user's KYC sessions
     */
    listUserSessions(userId: string, options?: {
        limit?: number;
        offset?: number;
        status?: string;
        provider?: string;
    }): Promise<{
        sessions: KycSession[];
        total: number;
    }>;
    /**
     * Get KYC statistics
     */
    getStatistics(options?: {
        startDate?: Date;
        endDate?: Date;
        provider?: string;
    }): Promise<{
        totalSessions: number;
        completedSessions: number;
        approvedSessions: number;
        rejectedSessions: number;
        averageCompletionTime: number;
        successRate: number;
    }>;
    /**
     * Update configuration for all HTTP requests
     */
    updateConfig(config: Partial<OneKeyConfig>): void;
    /**
     * Private helper methods
     */
    private validateWebhook;
    /**
     * Cleanup method
     */
    destroy(): void;
}
export declare function createKycClient(config: OneKeyConfig): KycClient;
//# sourceMappingURL=kyc-client.d.ts.map