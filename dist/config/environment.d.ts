interface Config {
    api: {
        version: string;
    };
    server: {
        port: number;
        nodeEnv: string;
    };
    jwt: {
        secret: string;
        refreshSecret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    database: {
        url: string;
        host: string;
        port: number;
        name: string;
        user: string;
        password: string;
    };
    supabase: {
        url: string;
        anonKey: string;
        serviceKey: string;
    };
    kycProviders: {
        smileIdentity: {
            apiKey: string;
            partnerId: string;
        };
        onfido: {
            apiKey: string;
        };
        trulioo: {
            apiKey: string;
        };
    };
    blockchain: {
        privyAppId: string;
        privyAppSecret: string;
        chainId: number;
        rpcUrl: string;
        easContractAddress: string;
        easSchemaRegistryAddress: string;
        attesterPrivateKey: string;
        attesterAddress: string;
        easSchemaId: string;
        easAttestationUrl: string;
    };
    storage: {
        filecoinApiKey: string;
        arweaveWalletPath: string;
        litProtocolNetwork: string;
    };
    security: {
        corsOrigin: string;
        rateLimitWindowMs: number;
        rateLimitMaxRequests: number;
        encryptionKey: string;
        encryptionIv: string;
        hashSalt: string;
    };
    encryption: {
        enabled: boolean;
        defaultAlgorithm: 'aes-256-gcm' | 'aes-256-cbc' | 'chacha20-poly1305';
        keyDerivation: {
            algorithm: 'pbkdf2' | 'scrypt' | 'argon2';
            iterations: number;
            saltLength: number;
            keyLength: number;
            hashFunction: 'sha256' | 'sha512';
        };
        keyRotationInterval: number;
        maxKeyAge: number;
        compressionEnabled: boolean;
        integrityCheckEnabled: boolean;
        maxFileSize: number;
        masterKey: string;
        saltSeed: string;
    };
}
declare const config: Config;
export { config };
//# sourceMappingURL=environment.d.ts.map