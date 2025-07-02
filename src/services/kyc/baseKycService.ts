// OneKey KYC API - Base KYC Service

import {
  KycUser,
  KycSession,
  KycVerificationResult,
  CreateKycSessionRequest,
  UpdateKycSessionRequest,
  KycProvider,
  KycProviderConfig,
  KycError,
  KycProviderError,
  KycSessionNotFoundError
} from '@/types/kyc';
import { v4 as uuidv4 } from 'uuid';

export interface IKycService {
  provider: KycProvider;
  createSession(request: CreateKycSessionRequest): Promise<KycSession>;
  getSession(sessionId: string): Promise<KycSession>;
  updateSession(sessionId: string, updates: UpdateKycSessionRequest): Promise<KycSession>;
  startVerification(sessionId: string): Promise<KycVerificationResult>;
  healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, any> }>;
}

export abstract class BaseKycService implements IKycService {
  abstract provider: KycProvider;
  protected config: KycProviderConfig;
  protected sessions: Map<string, KycSession> = new Map();

  constructor(config: KycProviderConfig) {
    this.config = config;
  }

  async createSession(request: CreateKycSessionRequest): Promise<KycSession> {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    const session: KycSession = {
      id: uuidv4(),
      userId: request.user.id,
      sessionId,
      provider: this.provider,
      status: 'pending',
      countryCode: request.user.address?.country,
      documentType: request.document?.type,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: request.metadata || {}
    };
    
    this.sessions.set(sessionId, session);
    await this.createProviderSession(session, request);
    
    return session;
  }

  async getSession(sessionId: string): Promise<KycSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new KycSessionNotFoundError(sessionId);
    }
    return session;
  }

  async updateSession(sessionId: string, updates: UpdateKycSessionRequest): Promise<KycSession> {
    const session = await this.getSession(sessionId);
    const updatedSession = { ...session, ...updates, updatedAt: new Date().toISOString() };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  async startVerification(sessionId: string): Promise<KycVerificationResult> {
    const session = await this.getSession(sessionId);
    await this.updateSession(sessionId, { status: 'processing' });
    return this.performVerification(session);
  }

  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: Record<string, any> }> {
    try {
      const details = await this.checkProviderHealth();
      return { status: 'healthy', details };
    } catch (error) {
      return { status: 'unhealthy', details: { error: (error as Error).message } };
    }
  }

  protected generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${this.provider}_${timestamp}_${random}`;
  }

  getProviderConfig(): KycProviderConfig {
    return this.config;
  }

  protected abstract createProviderSession(session: KycSession, request: CreateKycSessionRequest): Promise<void>;
  protected abstract performVerification(session: KycSession): Promise<KycVerificationResult>;
  protected abstract checkProviderHealth(): Promise<Record<string, any>>;
} 