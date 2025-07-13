// Export encryption manager and related types
export {
  EncryptionManager,
  EncryptionOptions,
  EncryptionResult,
  DecryptionOptions,
  KeyPair,
  createEncryptionManager,
  generateSecurePassword,
  validateEncryptionKey
} from './encryption';

// Export crypto client
export { CryptoClient, createCryptoClient } from './crypto-client';

// Re-export crypto-related types from main types
export type { CryptoProvider } from '../types'; 