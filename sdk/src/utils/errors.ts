import { OneKeyError } from '../types';

export default OneKeyError;

// Error factory functions for common error scenarios
export function createAuthenticationError(message: string, originalError?: any): OneKeyError {
  return new OneKeyError('AUTHENTICATION_FAILED', message, originalError);
}

export function createValidationError(message: string, originalError?: any): OneKeyError {
  return new OneKeyError('VALIDATION_ERROR', message, originalError);
}

export function createApiError(message: string, originalError?: any): OneKeyError {
  return new OneKeyError('API_ERROR', message, originalError);
}

export function createNetworkError(message: string, originalError?: any): OneKeyError {
  return new OneKeyError('NETWORK_ERROR', message, originalError);
}

export function createConfigError(message: string, originalError?: any): OneKeyError {
  return new OneKeyError('INVALID_CONFIG', message, originalError);
}

// Error type guards
export function isOneKeyError(error: any): error is OneKeyError {
  return error instanceof OneKeyError;
}

export function isAuthenticationError(error: any): boolean {
  return isOneKeyError(error) && error.code === 'AUTHENTICATION_FAILED';
}

export function isValidationError(error: any): boolean {
  return isOneKeyError(error) && error.code === 'VALIDATION_ERROR';
}

export function isApiError(error: any): boolean {
  return isOneKeyError(error) && error.code === 'API_ERROR';
}

export function isNetworkError(error: any): boolean {
  return isOneKeyError(error) && error.code === 'NETWORK_ERROR';
}

export function isConfigError(error: any): boolean {
  return isOneKeyError(error) && error.code === 'INVALID_CONFIG';
} 