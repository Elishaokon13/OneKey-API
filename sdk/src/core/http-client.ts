// OneKey SDK HTTP Client
// Handles all HTTP communication with the OneKey API

import { EventEmitter } from 'eventemitter3';
import {
  OneKeyConfig,
  ApiResponse,
  ApiError,
  NetworkError,
  AuthenticationError,
  ValidationError,
  OneKeyError
} from '../types';

export interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  data?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  skipAuth?: boolean;
}

export class HttpClient extends EventEmitter {
  private config: Required<OneKeyConfig>;
  private accessToken: string | null = null;

  constructor(config: OneKeyConfig) {
    super();
    
    // Set defaults
    this.config = {
      apiKey: config.apiKey,
      environment: config.environment || 'production',
      baseUrl: config.baseUrl || this.getDefaultBaseUrl(config.environment || 'production'),
      timeout: config.timeout || 30000,
      headers: config.headers || {},
      debug: config.debug || false,
      retry: config.retry || {
        attempts: 3,
        delay: 1000,
        backoff: 'exponential'
      }
    };

    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new ValidationError('API key is required');
    }

    if (this.config.apiKey.length < 10) {
      throw new ValidationError('Invalid API key format');
    }
  }

  private getDefaultBaseUrl(environment: string): string {
    switch (environment) {
      case 'sandbox':
        return 'https://api-sandbox.onekey.so/v1';
      case 'production':
      default:
        return 'https://api.onekey.so/v1';
    }
  }

  /**
   * Set access token for authenticated requests
   */
  public setAccessToken(token: string): void {
    this.accessToken = token;
    this.emit('token:set', token);
  }

  /**
   * Clear access token
   */
  public clearAccessToken(): void {
    this.accessToken = null;
    this.emit('token:cleared');
  }

  /**
   * Get current access token
   */
  public getAccessToken(): string | null {
    return this.accessToken;
  }

  /**
   * Authenticate with API key and get access token
   */
  public async authenticate(): Promise<string> {
    try {
      if (this.config.debug) {
        console.log('[OneKey SDK] Authenticating with API key...');
      }

      const response = await this.request<{ token: string }>({
        method: 'POST',
        endpoint: '/auth/login',
        data: {
          apiKey: this.config.apiKey
        },
        skipAuth: true
      });

      if (!response.data?.token) {
        throw new AuthenticationError('No token received from authentication');
      }

      this.setAccessToken(response.data.token);
      
      if (this.config.debug) {
        console.log('[OneKey SDK] Authentication successful');
      }

      return response.data.token;
    } catch (error) {
      if (this.config.debug) {
        console.error('[OneKey SDK] Authentication failed:', error);
      }
      throw new AuthenticationError('Authentication failed', { 
        originalError: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  public async request<T = any>(options: RequestOptions): Promise<ApiResponse<T>> {
    const { method, endpoint, data, params, headers = {}, timeout, skipAuth = false } = options;

    // Prepare URL
    const url = `${this.config.baseUrl}${endpoint}`;
    
    // Prepare headers
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'OneKey-SDK/1.0.0',
      ...this.config.headers,
      ...headers
    };

    // Add authentication header
    if (!skipAuth && this.accessToken) {
      requestHeaders['Authorization'] = `Bearer ${this.accessToken}`;
    }

    // Prepare URL with query params
    const urlWithParams = params ? `${url}?${new URLSearchParams(params).toString()}` : url;

    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout || this.config.timeout)
    };

    if (data && method !== 'GET') {
      requestOptions.body = JSON.stringify(data);
    }

    if (this.config.debug) {
      console.log(`[OneKey SDK] ${method} ${urlWithParams}`, {
        headers: requestHeaders,
        data
      });
    }

    // Execute request with retry logic
    return this.executeWithRetry(urlWithParams, requestOptions);
  }

  private async executeWithRetry<T>(url: string, options: RequestInit): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.retry.attempts; attempt++) {
      try {
        const response = await fetch(url, options);
        const result = await this.handleResponse<T>(response);
        
        if (this.config.debug && attempt > 1) {
          console.log(`[OneKey SDK] Request succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry on authentication errors or validation errors
        if (error instanceof AuthenticationError || error instanceof ValidationError) {
          throw error;
        }

        // Don't retry on 4xx errors (except 429)
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 429) {
          throw error;
        }

        if (attempt < this.config.retry.attempts) {
          const delay = this.calculateRetryDelay(attempt);
          
          if (this.config.debug) {
            console.log(`[OneKey SDK] Request failed (attempt ${attempt}), retrying in ${delay}ms...`, error);
          }
          
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new NetworkError('Request failed after all retry attempts');
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    let responseData: any;
    
    try {
      responseData = await response.json();
    } catch (error) {
      throw new NetworkError('Invalid JSON response from server');
    }

    if (this.config.debug) {
      console.log(`[OneKey SDK] Response:`, {
        status: response.status,
        data: responseData
      });
    }

    // Handle error responses
    if (!response.ok) {
      const errorCode = responseData?.error?.code || 'UNKNOWN_ERROR';
      const errorMessage = responseData?.error?.message || `HTTP ${response.status} Error`;
      const errorDetails = responseData?.error?.details;

      if (response.status === 401) {
        this.clearAccessToken();
        throw new AuthenticationError(errorMessage, errorDetails);
      }

      if (response.status === 400) {
        throw new ValidationError(errorMessage, errorDetails);
      }

      throw new ApiError(errorMessage, response.status, errorCode, errorDetails);
    }

    // Handle success responses
    if (!responseData.success) {
      throw new OneKeyError(
        responseData.error?.message || 'API request failed',
        responseData.error?.code || 'API_ERROR',
        responseData.error?.details
      );
    }

    return responseData as ApiResponse<T>;
  }

  private calculateRetryDelay(attempt: number): number {
    const baseDelay = this.config.retry.delay;
    
    if (this.config.retry.backoff === 'exponential') {
      return baseDelay * Math.pow(2, attempt - 1);
    }
    
    return baseDelay * attempt;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<OneKeyConfig>): void {
    Object.assign(this.config, newConfig);
    
    if (newConfig.baseUrl) {
      this.config.baseUrl = newConfig.baseUrl;
    }
    
    this.emit('config:updated', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): Readonly<Required<OneKeyConfig>> {
    return { ...this.config };
  }
} 