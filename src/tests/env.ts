// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TEST_REDIS_HOST = 'localhost';
process.env.TEST_REDIS_PORT = '6379';
process.env.TEST_REDIS_DB = '1';
process.env.TEST_REDIS_PASSWORD = '';
process.env.RATE_LIMIT_MAX = '50';
process.env.RATE_LIMIT_WINDOW = '60000';
process.env.RATE_LIMIT_BLOCK_DURATION = '300000'; 