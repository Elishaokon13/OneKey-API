"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeSupabase = exports.isSupabaseConfigured = exports.subscribeToKycUpdates = exports.checkSupabaseHealth = exports.getSupabaseServiceClient = exports.getSupabaseClient = exports.initializeSupabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const environment_1 = __importDefault(require("./environment"));
// Supabase client instances
let supabaseClient = null;
let supabaseServiceClient = null;
// Initialize Supabase clients
const initializeSupabase = () => {
    if (!environment_1.default.supabase.url || !environment_1.default.supabase.anonKey) {
        console.log('⚠️  Supabase configuration not found, using direct PostgreSQL connection');
        return;
    }
    try {
        console.log('🔗 Initializing Supabase clients...');
        // Public client (for frontend interactions)
        supabaseClient = (0, supabase_js_1.createClient)(environment_1.default.supabase.url, environment_1.default.supabase.anonKey, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
            },
        });
        // Service role client (for server-side operations)
        if (environment_1.default.supabase.serviceKey) {
            supabaseServiceClient = (0, supabase_js_1.createClient)(environment_1.default.supabase.url, environment_1.default.supabase.serviceKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            });
        }
        console.log('✅ Supabase clients initialized successfully');
        console.log(`📊 Connected to: ${environment_1.default.supabase.url}`);
    }
    catch (error) {
        console.error('❌ Supabase initialization failed:', error);
        throw new Error(`Supabase initialization failed: ${error.message}`);
    }
};
exports.initializeSupabase = initializeSupabase;
// Get public Supabase client (for user interactions)
const getSupabaseClient = () => {
    if (!supabaseClient) {
        throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
    }
    return supabaseClient;
};
exports.getSupabaseClient = getSupabaseClient;
// Get service role client (for admin operations)
const getSupabaseServiceClient = () => {
    if (!supabaseServiceClient) {
        throw new Error('Supabase service client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
    }
    return supabaseServiceClient;
};
exports.getSupabaseServiceClient = getSupabaseServiceClient;
// Supabase health check
const checkSupabaseHealth = async () => {
    try {
        if (!supabaseClient) {
            return {
                status: 'disconnected',
                details: {
                    connected: false,
                    publicClient: false,
                    serviceClient: false,
                },
            };
        }
        // Test connection with a simple query
        const { data, error } = await supabaseServiceClient?.from('users').select('count').limit(1) || {};
        if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist" which is OK if tables aren't created yet
            throw error;
        }
        return {
            status: 'healthy',
            details: {
                connected: true,
                publicClient: !!supabaseClient,
                serviceClient: !!supabaseServiceClient,
                url: environment_1.default.supabase.url,
            },
        };
    }
    catch (error) {
        console.error('Supabase health check failed:', error);
        return {
            status: 'unhealthy',
            details: {
                connected: false,
                publicClient: !!supabaseClient,
                serviceClient: !!supabaseServiceClient,
                url: environment_1.default.supabase.url,
            },
        };
    }
};
exports.checkSupabaseHealth = checkSupabaseHealth;
// Real-time subscriptions for KYC status updates
const subscribeToKycUpdates = (userId, callback) => {
    if (!supabaseClient) {
        throw new Error('Supabase client not initialized');
    }
    return supabaseClient
        .channel(`kyc_updates_${userId}`)
        .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'kyc_sessions',
        filter: `user_id=eq.${userId}`,
    }, callback)
        .subscribe();
};
exports.subscribeToKycUpdates = subscribeToKycUpdates;
// Utility function to check if Supabase is configured
const isSupabaseConfigured = () => {
    return !!(environment_1.default.supabase.url && environment_1.default.supabase.anonKey);
};
exports.isSupabaseConfigured = isSupabaseConfigured;
// Close Supabase connections (for cleanup)
const closeSupabase = async () => {
    if (supabaseClient) {
        console.log('🔌 Closing Supabase connections...');
        await supabaseClient.auth.signOut();
        supabaseClient = null;
        supabaseServiceClient = null;
        console.log('✅ Supabase connections closed');
    }
};
exports.closeSupabase = closeSupabase;
//# sourceMappingURL=supabase.js.map