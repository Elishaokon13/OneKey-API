import { EventEmitter } from 'eventemitter3';
import { OneKeyConfig, ApiResponse } from '../types';
export interface RequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    endpoint: string;
    data?: any;
    params?: Record<string, any>;
    headers?: Record<string, string>;
    timeout?: number;
    skipAuth?: boolean;
}
export declare class HttpClient extends EventEmitter {
    private config;
    private accessToken;
    constructor(config: OneKeyConfig);
    private validateConfig;
    private getDefaultBaseUrl;
    /**
     * Set access token for authenticated requests
     */
    setAccessToken(token: string): void;
    /**
     * Clear access token
     */
    clearAccessToken(): void;
    /**
     * Get current access token
     */
    getAccessToken(): string | null;
    /**
     * Authenticate with API key and get access token
     */
    authenticate(): Promise<string>;
    /**
     * Make HTTP request with retry logic
     */
    request<T = any>(options: RequestOptions): Promise<ApiResponse<T>>;
    private executeWithRetry;
    private handleResponse;
    private calculateRetryDelay;
    private sleep;
    /**
     * GET request
     */
    get<T = any>(endpoint: string, params?: Record<string, any>, options?: Partial<RequestOptions>): Promise<ApiResponse<T>>;
    /**
     * POST request
     */
    post<T = any>(endpoint: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>>;
    /**
     * PATCH request
     */
    patch<T = any>(endpoint: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>>;
    /**
     * PUT request
     */
    put<T = any>(endpoint: string, data?: any, options?: Partial<RequestOptions>): Promise<ApiResponse<T>>;
    /**
     * DELETE request
     */
    delete<T = any>(endpoint: string, options?: Partial<RequestOptions>): Promise<ApiResponse<T>>;
    /**
     * Destroy/cleanup method
     */
    destroy(): void;
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<OneKeyConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): Readonly<typeof this.config>;
}
//# sourceMappingURL=http-client.d.ts.map