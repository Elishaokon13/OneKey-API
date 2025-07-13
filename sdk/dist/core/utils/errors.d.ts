import { OneKeyError } from '../types';
export default OneKeyError;
export declare function createAuthenticationError(message: string, originalError?: any): OneKeyError;
export declare function createValidationError(message: string, originalError?: any): OneKeyError;
export declare function createApiError(message: string, originalError?: any): OneKeyError;
export declare function createNetworkError(message: string, originalError?: any): OneKeyError;
export declare function createConfigError(message: string, originalError?: any): OneKeyError;
export declare function isOneKeyError(error: any): error is OneKeyError;
export declare function isAuthenticationError(error: any): boolean;
export declare function isValidationError(error: any): boolean;
export declare function isApiError(error: any): boolean;
export declare function isNetworkError(error: any): boolean;
export declare function isConfigError(error: any): boolean;
//# sourceMappingURL=errors.d.ts.map