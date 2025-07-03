"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
const config = {
    api: {
        version: process.env.API_VERSION || '1.0.0',
    },
    server: {
        port: parseInt(process.env.PORT || '3000', 10),
        nodeEnv: process.env.NODE_ENV || 'development',
    },
    jwt: {
        secret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
        refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    },
    database: {
        url: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://localhost:5432/onekey_db',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        name: process.env.DB_NAME || 'onekey_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
    },
    supabase: {
        url: process.env.SUPABASE_URL || '',
        anonKey: process.env.SUPABASE_ANON_KEY || '',
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    },
    kycProviders: {
        smileIdentity: {
            apiKey: process.env.SMILE_IDENTITY_API_KEY || '',
            partnerId: process.env.SMILE_IDENTITY_PARTNER_ID || '',
        },
        onfido: {
            apiKey: process.env.ONFIDO_API_KEY || '',
        },
        trulioo: {
            apiKey: process.env.TRULIOO_API_KEY || '',
        },
    },
    blockchain: {
        privyAppId: process.env.PRIVY_APP_ID || '',
        privyAppSecret: process.env.PRIVY_APP_SECRET || '',
        chainId: parseInt(process.env.BLOCKCHAIN_CHAIN_ID || '84532', 10), // Base Sepolia
        rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'https://sepolia.base.org',
        easContractAddress: process.env.EAS_CONTRACT_ADDRESS || '0x4200000000000000000000000000000000000021',
        easSchemaRegistryAddress: process.env.EAS_SCHEMA_REGISTRY_ADDRESS || '0x4200000000000000000000000000000000000020',
        attesterPrivateKey: process.env.ATTESTER_PRIVATE_KEY || '',
        attesterAddress: process.env.ATTESTER_ADDRESS || '',
        easSchemaId: process.env.EAS_SCHEMA_ID || '',
        easAttestationUrl: process.env.EAS_ATTESTATION_URL || 'https://base-sepolia.easscan.org',
    },
    storage: {
        filecoinApiKey: process.env.FILECOIN_API_KEY || '',
        arweaveWalletPath: process.env.ARWEAVE_WALLET_PATH || './arweave-wallet.json',
        litProtocolNetwork: process.env.LIT_PROTOCOL_NETWORK || 'cayenne',
    },
    security: {
        corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
        rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
        encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-change-in-production',
        encryptionIv: process.env.ENCRYPTION_IV || 'dev-encryption-iv-change-in-production',
        hashSalt: process.env.HASH_SALT || 'dev-hash-salt-change-in-production',
    },
    encryption: {
        enabled: process.env.ENCRYPTION_ENABLED === 'true',
        defaultAlgorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
        keyDerivation: {
            algorithm: process.env.KEY_DERIVATION_ALGORITHM || 'pbkdf2',
            iterations: parseInt(process.env.KEY_DERIVATION_ITERATIONS || '100000'),
            saltLength: parseInt(process.env.KEY_DERIVATION_SALT_LENGTH || '32'),
            keyLength: parseInt(process.env.KEY_DERIVATION_KEY_LENGTH || '32'),
            hashFunction: process.env.KEY_DERIVATION_HASH || 'sha256'
        },
        keyRotationInterval: parseInt(process.env.KEY_ROTATION_INTERVAL_HOURS || '24'),
        maxKeyAge: parseInt(process.env.MAX_KEY_AGE_HOURS || '168'), // 7 days
        compressionEnabled: process.env.ENCRYPTION_COMPRESSION_ENABLED !== 'false',
        integrityCheckEnabled: process.env.ENCRYPTION_INTEGRITY_CHECK_ENABLED !== 'false',
        maxFileSize: parseInt(process.env.ENCRYPTION_MAX_FILE_SIZE || '52428800'), // 50MB
        masterKey: process.env.ENCRYPTION_MASTER_KEY || 'dev-master-key-change-in-production',
        saltSeed: process.env.ENCRYPTION_SALT_SEED || 'dev-salt-seed-change-in-production'
    },
    arweave: {
        // Network settings
        host: process.env.ARWEAVE_HOST || 'arweave.net',
        port: parseInt(process.env.ARWEAVE_PORT || '443'),
        protocol: (process.env.ARWEAVE_PROTOCOL || 'https'),
        timeout: parseInt(process.env.ARWEAVE_TIMEOUT || '60000'),
        logging: process.env.ARWEAVE_LOGGING === 'true',
        // Gateway URLs for retrieval
        gatewayUrls: (process.env.ARWEAVE_GATEWAY_URLS || 'https://arweave.net,https://arweave.dev').split(','),
        defaultGateway: process.env.ARWEAVE_DEFAULT_GATEWAY || 'https://arweave.net',
        // Wallet configuration
        wallet: {
            ...(process.env.ARWEAVE_WALLET_KEY_FILE && { keyFile: process.env.ARWEAVE_WALLET_KEY_FILE }),
            ...(process.env.ARWEAVE_WALLET_KEY_DATA && { keyData: JSON.parse(process.env.ARWEAVE_WALLET_KEY_DATA) }),
            ...(process.env.ARWEAVE_WALLET_ADDRESS && { address: process.env.ARWEAVE_WALLET_ADDRESS }),
            ...(process.env.ARWEAVE_WALLET_PRIVATE_KEY && { privateKey: process.env.ARWEAVE_WALLET_PRIVATE_KEY })
        },
        // Bundling configuration
        bundling: {
            enabled: process.env.ARWEAVE_BUNDLING_ENABLED === 'true',
            maxBundleSize: parseInt(process.env.ARWEAVE_MAX_BUNDLE_SIZE || '10485760'), // 10MB
            maxItems: parseInt(process.env.ARWEAVE_MAX_BUNDLE_ITEMS || '100')
        },
        // Retry policy
        retryPolicy: {
            maxRetries: parseInt(process.env.ARWEAVE_MAX_RETRIES || '3'),
            retryDelay: parseInt(process.env.ARWEAVE_RETRY_DELAY || '1000'),
            backoffMultiplier: parseFloat(process.env.ARWEAVE_BACKOFF_MULTIPLIER || '2.0')
        },
        // Caching
        caching: {
            enabled: process.env.ARWEAVE_CACHING_ENABLED === 'true',
            ttl: parseInt(process.env.ARWEAVE_CACHE_TTL || '3600'), // 1 hour
            maxSize: parseInt(process.env.ARWEAVE_CACHE_MAX_SIZE || '1000')
        }
    },
};
exports.config = config;
//# sourceMappingURL=environment.js.map