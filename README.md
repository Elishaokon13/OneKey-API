# OneKey API

A secure and scalable API service for managing user authentication, authorization, and identity verification.

## Features

### Authentication & Authorization
- **Role-Based Access Control (RBAC)**
  - Hierarchical role system
  - Fine-grained permission management
  - Wildcard permission support
  - Role inheritance
  
- **Attribute-Based Access Control (ABAC)**
  - Dynamic attribute validation
  - Complex condition evaluation
  - Context-based rules
  - Custom attribute support

- **Performance Optimizations**
  - Redis caching for RBAC/ABAC configurations
  - Batch processing for audit logs
  - Materialized views for common queries
  - Optimized database schema

### Security
- **Access Control**
  - Request context validation
  - Rate limiting
  - Audit logging with encryption
  - Multi-tenant isolation

- **Lit Protocol Integration**
  - Encrypted data access
  - Chain-specific conditions
  - Session capability caching
  - Performance monitoring

### Database & Storage
- **PostgreSQL with Supabase**
  - Robust schema design
  - Foreign key constraints
  - Transaction support
  - Migration system

- **Caching Layer**
  - Redis integration
  - Configurable TTL
  - Cache invalidation
  - Performance monitoring

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Environment Setup
1. Clone the repository
2. Copy `env.example` to `.env`
3. Configure environment variables:
   ```
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/onekey
   
   # Redis
   REDIS_ENABLED=true
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=
   REDIS_DB=0
   REDIS_TTL=3600
   REDIS_KEY_PREFIX=onekey:
   
   # Other configurations...
   ```

### Installation
```bash
npm install
npm run migrate
npm run seed # Optional: Add test data
npm run dev
```

## Architecture

### Core Components
1. **Access Control Service**
   - RBAC/ABAC management
   - Permission evaluation
   - Cache management
   - Audit logging

2. **Authentication Service**
   - User authentication
   - Session management
   - JWT handling
   - Privy integration

3. **KYC Service**
   - Identity verification
   - Multiple provider support
   - Verification workflow
   - Status tracking

4. **Encryption Service**
   - Lit Protocol integration
   - Data encryption/decryption
   - Access condition management
   - Key management

### Performance Features
1. **Caching Strategy**
   - RBAC/ABAC config caching
   - User role/attribute caching
   - Session capability caching
   - Configurable TTL

2. **Database Optimizations**
   - Materialized views
   - Efficient indexing
   - Query optimization
   - Connection pooling

3. **Monitoring & Logging**
   - Performance metrics
   - Error tracking
   - Audit trail
   - Cost estimation

## API Documentation

Detailed API documentation is available in the `/docs` directory, covering:
- Authentication flows
- Access control endpoints
- KYC integration
- Encryption services
- Webhook handling

## Testing

The codebase includes comprehensive tests:
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "AccessControl"

# Run with coverage
npm run test:coverage
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 