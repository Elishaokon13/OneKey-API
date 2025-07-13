// Export encryption manager and related types
export {
  EncryptionManager,
  createEncryptionManager,
  generateSecurePassword,
  validateEncryptionKey
} from './encryption';

export type {
  EncryptionOptions,
  EncryptionResult,
  DecryptionOptions,
  KeyPair
} from './encryption';

// Export crypto client
export { CryptoClient, createCryptoClient } from './crypto-client';

// Re-export crypto-related types from main types
export type { CryptoProvider } from '../types'; 