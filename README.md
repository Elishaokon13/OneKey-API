# OneKey KYC API

A privacy-preserving identity verification system that provides secure KYC (Know Your Customer) verification with zero-PII storage, blockchain attestations, and client-side encryption.

## 🚀 Features

### Core Capabilities
- **Multi-Provider KYC**: Integration with Smile Identity, Onfido, and Trulioo
- **Zero-PII Storage**: Client-side encryption ensures no personal data is stored on servers
- **Blockchain Attestations**: Ethereum Attestation Service (EAS) integration for verifiable credentials
- **Web3 Authentication**: Privy integration for seamless wallet-based auth
- **Client-Side Encryption**: AES-256-GCM encryption with secure key management
- **Decentralized Storage**: Ready for Filecoin/Arweave integration
- **Privacy-First**: Zero-knowledge proofs and selective disclosure support

### Security & Performance
- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: Intelligent rate limiting per endpoint and user
- **Request Validation**: Comprehensive input validation and sanitization
- **Security Headers**: CORS, CSRF protection, and security middleware
- **Health Monitoring**: Real-time system health and performance metrics
- **Audit Logging**: Comprehensive logging for compliance and debugging

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client App    │    │  OneKey API     │    │  Blockchain     │
│                 │    │                 │    │                 │
│ • Web3 Auth     │◄──►│ • KYC Service   │◄──►│ • EAS Contract  │
│ • Encryption    │    │ • Attestation   │    │ • Ethereum      │
│ • File Upload   │    │ • Encryption    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  External APIs  │
                       │                 │
                       │ • Smile Identity│
                       │ • Onfido        │
                       │ • Trulioo       │
                       │ • Privy         │
                       └─────────────────┘
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + Privy Web3
- **Blockchain**: Ethereum Attestation Service (EAS)
- **Encryption**: AES-256-GCM, PBKDF2, Scrypt
- **Validation**: express-validator, Joi
- **Logging**: Winston
- **Testing**: Jest
- **Development**: Nodemon, ts-node

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Ethereum wallet for attestations
- KYC provider API keys (Smile Identity, Onfido, Trulioo)
- Privy account for Web3 auth

### Setup

1. **Clone the repository**
```bash
git clone <repository-url>
cd onekey-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp env.example .env
```

4. **Configure environment variables** (see [Environment Configuration](#environment-configuration))

5. **Run database migrations**
```bash
npm run migrate
```

6. **Start development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## ⚙️ Environment Configuration

### Required Variables

```env
# API Configuration
NODE_ENV=development
PORT=3000
API_VERSION=1.0.0

# Database (Supabase)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
DATABASE_URL=your_postgres_url

# Authentication
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=24h

# Privy Web3 Authentication
PRIVY_APP_ID=your_privy_app_id
PRIVY_APP_SECRET=your_privy_app_secret

# KYC Providers
SMILE_IDENTITY_API_KEY=your_smile_identity_key
SMILE_IDENTITY_PARTNER_ID=your_partner_id
ONFIDO_API_KEY=your_onfido_key
TRULIOO_API_KEY=your_trulioo_key

# Blockchain (Ethereum)
BLOCKCHAIN_RPC_URL=your_ethereum_rpc_url
BLOCKCHAIN_CHAIN_ID=1
EAS_CONTRACT_ADDRESS=0x...
EAS_SCHEMA_REGISTRY_ADDRESS=0x...
ATTESTER_PRIVATE_KEY=your_private_key
ATTESTER_ADDRESS=your_wallet_address
EAS_SCHEMA_ID=your_schema_id

# Encryption
ENCRYPTION_ENABLED=true
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_KEY_DERIVATION=pbkdf2
MASTER_KEY=your_master_key
SALT_SEED=your_salt_seed

# Security
SECURITY_HASH_SALT=your_hash_salt
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## 📚 API Documentation

### Base URL
```
http://localhost:3000/api/v1
```

### Authentication
All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Core Endpoints

#### KYC Verification
```http
POST /api/v1/kyc/sessions
Content-Type: application/json

{
  "provider": "smile_identity",
  "user": {
    "id": "user123",
    "email": "user@example.com"
  },
  "documentType": "passport",
  "country": "US"
}
```

#### Encryption Service
```http
POST /api/v1/encryption/encrypt
Authorization: Bearer <token>
Content-Type: application/json

{
  "data": "sensitive information",
  "password": "user_password",
  "compression": true
}
```

#### Attestation Creation
```http
POST /api/v1/attestations
Authorization: Bearer <token>
Content-Type: application/json

{
  "recipient": "0x1234567890123456789012345678901234567890",
  "kycSessionId": "session_123",
  "expirationHours": 8760,
  "metadata": {
    "purpose": "identity_verification"
  }
}
```

### Complete API Reference

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | System health check | No |
| POST | `/auth/login` | JWT authentication | No |
| POST | `/auth/privy/verify` | Privy Web3 auth | No |
| POST | `/kyc/sessions` | Create KYC session | Yes |
| GET | `/kyc/sessions/:id` | Get KYC session | Yes |
| POST | `/kyc/sessions/:id/upload` | Upload documents | Yes |
| GET | `/kyc/providers` | List KYC providers | Yes |
| POST | `/encryption/encrypt` | Encrypt data | Yes |
| POST | `/encryption/decrypt` | Decrypt data | Yes |
| POST | `/encryption/keys/generate` | Generate encryption key | Yes |
| POST | `/attestations` | Create attestation | Yes |
| GET | `/attestations/:uid` | Get attestation | Yes |
| POST | `/attestations/verify` | Verify attestation | Yes |
| POST | `/attestations/revoke` | Revoke attestation | Yes |

## 🚀 Usage Examples

### Complete KYC Flow

```javascript
// 1. Create KYC session
const session = await fetch('/api/v1/kyc/sessions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    provider: 'smile_identity',
    user: { id: 'user123', email: 'user@example.com' },
    documentType: 'passport',
    country: 'US'
  })
});

// 2. Upload encrypted documents
const encrypted = await fetch('/api/v1/encryption/encrypt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    data: documentData,
    password: userPassword
  })
});

// 3. Submit for verification
const upload = await fetch(`/api/v1/kyc/sessions/${sessionId}/upload`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    encryptedData: encrypted.data.encryptedData
  })
});

// 4. Create blockchain attestation
const attestation = await fetch('/api/v1/attestations', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    recipient: walletAddress,
    kycSessionId: sessionId,
    expirationHours: 8760
  })
});
```

### Web3 Authentication

```javascript
// Using Privy for Web3 authentication
const privyAuth = await fetch('/api/v1/auth/privy/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accessToken: privyAccessToken
  })
});

const { token } = privyAuth.data;
// Use token for subsequent API calls
```

## 🏗️ Development

### Project Structure
```
src/
├── config/          # Configuration management
├── database/        # Database migrations and setup
├── middleware/      # Express middleware (auth, validation, etc.)
├── routes/          # API route handlers
├── services/        # Business logic services
│   ├── auth/        # Authentication services
│   ├── encryption/  # Encryption services
│   ├── kyc/         # KYC provider integrations
│   └── attestation/ # Blockchain attestation services
├── types/           # TypeScript type definitions
├── utils/           # Utility functions
└── index.ts         # Application entry point
```

### Available Scripts

```bash
# Development
npm run dev          # Start development server with hot reload
npm run build        # Build for production
npm run start        # Start production server

# Database
npm run migrate      # Run database migrations
npm run migrate:down # Rollback migrations

# Testing
npm run test         # Run test suite
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Generate coverage report

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript compiler check
```

### Development Workflow

1. **Feature Development**
   - Create feature branch from `main`
   - Implement feature with tests
   - Update documentation if needed
   - Create pull request

2. **Testing**
   ```bash
   npm run test                    # Unit tests
   npm run test:integration       # Integration tests
   npm run test:e2e              # End-to-end tests
   ```

3. **Code Quality**
   ```bash
   npm run lint                   # Check code style
   npm run type-check            # Verify TypeScript
   npm run test:coverage         # Ensure test coverage
   ```

## 🔒 Security Considerations

### Data Protection
- **Zero-PII Storage**: All personal data is encrypted client-side
- **Encryption at Rest**: Database encryption for all stored data  
- **Encryption in Transit**: TLS 1.3 for all API communication
- **Key Management**: Secure key derivation and rotation

### Authentication & Authorization
- **Multi-factor Authentication**: Web3 signatures + JWT tokens
- **Rate Limiting**: Configurable limits per endpoint and user
- **Request Validation**: Comprehensive input sanitization
- **CORS Protection**: Configurable cross-origin policies

### Blockchain Security
- **Private Key Management**: Secure key storage and rotation
- **Gas Price Optimization**: Dynamic gas estimation
- **Transaction Monitoring**: Real-time transaction tracking
- **Attestation Verification**: On-chain verification of all attestations

### Compliance
- **GDPR Compliance**: Right to erasure, data portability
- **SOC 2 Ready**: Audit logging and access controls
- **PCI DSS**: Secure handling of payment-related data
- **CCPA Compliance**: California privacy regulations

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Use TypeScript for all new code
- Follow ESLint configuration
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages

## 🗺️ Roadmap

### Phase 1: Core Infrastructure ✅
- [x] Multi-provider KYC integration
- [x] JWT authentication system
- [x] Client-side encryption
- [x] Blockchain attestations

### Phase 2: Advanced Features (Current)
- [ ] Filecoin/Arweave storage integration
- [ ] Lit Protocol access control
- [ ] Zero-knowledge proof system
- [ ] Advanced analytics dashboard

### Phase 3: Enterprise Features
- [ ] Multi-tenant architecture
- [ ] Custom KYC workflows
- [ ] Advanced compliance tools
- [ ] White-label solutions

---

**OneKey KYC API** - Privacy-preserving identity verification for the decentralized web. 