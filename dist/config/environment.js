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
};
exports.config = config;
//# sourceMappingURL=environment.js.map