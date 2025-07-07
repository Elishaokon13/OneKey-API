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
    - Configurable TTL for different cache types
    - Automatic cache invalidation
    - Graceful fallback when Redis is unavailable
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
    - Configurable connection settings
    - Automatic reconnection
    - Error handling and logging
    - Cache key prefixing
  - Configurable TTL
  - Cache invalidation
  - Performance monitoring

## Audit Log System

The system uses a Redis-based queue for processing audit logs in batches, improving performance and reliability:

### Features
- Batch processing of audit logs
- Configurable batch size and timeout
- Automatic fallback to direct database writes if Redis is unavailable
- Built-in error handling and retry mechanisms

### Configuration
Configure the audit log queue through environment variables:
```env
AUDIT_LOG_BATCH_SIZE=100      # Number of logs to process in each batch
AUDIT_LOG_BATCH_TIMEOUT=5000  # Time between batch processing in milliseconds
```

### Architecture
1. Audit logs are first queued in Redis
2. A background processor runs at configured intervals
3. Logs are processed in batches for better performance
4. Failed writes are handled gracefully with fallback mechanisms

### Monitoring
Monitor the queue status through:
- Redis queue length
- Processing metrics in logs
- Database write success/failure rates

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+ (optional)

### Environment Setup
1. Clone the repository
2. Copy `env.example` to `.env`
3. Configure environment variables:
   ```
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/onekey
   
   # Redis (optional)
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
   - RBAC/ABAC config caching (1 hour TTL)
   - User role/attribute caching (15 minutes TTL)
   - Session capability caching
   - Automatic cache invalidation
   - Graceful fallback when Redis is unavailable

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

### Test Environment
- Tests use a separate database (`onekey_test_db`)
- Redis tests handle Redis not being available
- Mock services for external dependencies
- Transaction-based test isolation

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 

## Performance Optimizations

### Materialized Views

The system uses materialized views to optimize common permission queries:

#### Available Views
- `mv_user_roles`: User roles with inheritance
- `mv_user_permissions`: Flattened user permissions
- `mv_project_rbac_config`: Project RBAC configurations
- `mv_project_abac_config`: Project ABAC configurations
- `mv_user_attributes`: User attributes for ABAC

#### Features
- Automatic refresh via database triggers
- Concurrent refresh support
- Performance monitoring and statistics
- Configurable refresh thresholds

#### View Management
The `ViewManager` service provides methods to:
- Refresh views manually or automatically
- Monitor view statistics
- Check view freshness
- Handle view maintenance

#### Performance Impact
- Reduced query complexity for permission checks
- Faster role hierarchy traversal
- Optimized RBAC/ABAC evaluations
- Improved response times for common operations

#### Maintenance
Views are automatically refreshed when:
- Role assignments change
- Project settings update
- User attributes change

Manual refresh can be triggered via the `ViewManager` service if needed. 