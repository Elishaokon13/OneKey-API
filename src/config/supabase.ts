import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from '@/config/environment';

// Supabase client instances
let supabaseClient: SupabaseClient | null = null;
let supabaseServiceClient: SupabaseClient | null = null;

// Database types (will be generated from Supabase)
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          wallet_address: string | null;
          passkey_id: string | null;
          created_at: string;
          updated_at: string;
          last_login: string | null;
          is_active: boolean;
          metadata: any;
        };
        Insert: {
          id?: string;
          email: string;
          wallet_address?: string | null;
          passkey_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
          is_active?: boolean;
          metadata?: any;
        };
        Update: {
          id?: string;
          email?: string;
          wallet_address?: string | null;
          passkey_id?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
          is_active?: boolean;
          metadata?: any;
        };
      };
      kyc_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          provider: string;
          status: string;
          country_code: string | null;
          document_type: string | null;
          verification_result: any | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          expires_at: string | null;
          metadata: any;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          provider: string;
          status?: string;
          country_code?: string | null;
          document_type?: string | null;
          verification_result?: any | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          expires_at?: string | null;
          metadata?: any;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          provider?: string;
          status?: string;
          country_code?: string | null;
          document_type?: string | null;
          verification_result?: any | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          expires_at?: string | null;
          metadata?: any;
        };
      };
      attestations: {
        Row: {
          id: string;
          user_id: string;
          kyc_session_id: string | null;
          attestation_id: string;
          schema_id: string;
          recipient: string;
          attester: string;
          data_hash: string;
          storage_cid: string | null;
          storage_url: string | null;
          revoked: boolean;
          revoked_at: string | null;
          created_at: string;
          expires_at: string | null;
          selective_attributes: any;
          metadata: any;
        };
        Insert: {
          id?: string;
          user_id: string;
          kyc_session_id?: string | null;
          attestation_id: string;
          schema_id: string;
          recipient: string;
          attester: string;
          data_hash: string;
          storage_cid?: string | null;
          storage_url?: string | null;
          revoked?: boolean;
          revoked_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          selective_attributes?: any;
          metadata?: any;
        };
        Update: {
          id?: string;
          user_id?: string;
          kyc_session_id?: string | null;
          attestation_id?: string;
          schema_id?: string;
          recipient?: string;
          attester?: string;
          data_hash?: string;
          storage_cid?: string | null;
          storage_url?: string | null;
          revoked?: boolean;
          revoked_at?: string | null;
          created_at?: string;
          expires_at?: string | null;
          selective_attributes?: any;
          metadata?: any;
        };
      };
      // Add other tables as needed
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      kyc_status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
      kyc_provider: 'smile_identity' | 'onfido' | 'trulioo';
      storage_type: 'filecoin' | 'arweave' | 'ipfs';
    };
  };
}

// Initialize Supabase clients
export const initializeSupabase = (): void => {
  if (!config.supabase.url || !config.supabase.anonKey) {
    console.log('⚠️  Supabase configuration not found, using direct PostgreSQL connection');
    return;
  }

  try {
    console.log('🔗 Initializing Supabase clients...');

    // Public client (for frontend interactions)
    supabaseClient = createClient(
      config.supabase.url,
      config.supabase.anonKey,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
        },
      }
    ) as SupabaseClient<Database>;

    // Service role client (for server-side operations)
    if (config.supabase.serviceKey) {
      supabaseServiceClient = createClient(
        config.supabase.url,
        config.supabase.serviceKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      ) as SupabaseClient<Database>;
    }

    console.log('✅ Supabase clients initialized successfully');
    console.log(`📊 Connected to: ${config.supabase.url}`);

  } catch (error) {
    console.error('❌ Supabase initialization failed:', error);
    throw new Error(`Supabase initialization failed: ${(error as Error).message}`);
  }
};

// Get public Supabase client (for user interactions)
export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Call initializeSupabase() first.');
  }
  return supabaseClient;
};

// Get service role client (for admin operations)
export const getSupabaseServiceClient = (): SupabaseClient<Database> => {
  if (!supabaseServiceClient) {
    throw new Error('Supabase service client not initialized. Check SUPABASE_SERVICE_ROLE_KEY.');
  }
  return supabaseServiceClient;
};

// Supabase health check
export const checkSupabaseHealth = async (): Promise<{
  status: string;
  details: {
    connected: boolean;
    publicClient: boolean;
    serviceClient: boolean;
    url?: string;
  };
}> => {
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
        url: config.supabase.url,
      },
    };
  } catch (error) {
    console.error('Supabase health check failed:', error);
    return {
      status: 'unhealthy',
      details: {
        connected: false,
        publicClient: !!supabaseClient,
        serviceClient: !!supabaseServiceClient,
        url: config.supabase.url,
      },
    };
  }
};

// Real-time subscriptions for KYC status updates
export const subscribeToKycUpdates = (
  userId: string,
  callback: (payload: any) => void
) => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized');
  }

  return supabaseClient
    .channel(`kyc_updates_${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'kyc_sessions',
        filter: `user_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
};

// Utility function to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!(config.supabase.url && config.supabase.anonKey);
};

// Close Supabase connections (for cleanup)
export const closeSupabase = async (): Promise<void> => {
  if (supabaseClient) {
    console.log('🔌 Closing Supabase connections...');
    await supabaseClient.auth.signOut();
    supabaseClient = null;
    supabaseServiceClient = null;
    console.log('✅ Supabase connections closed');
  }
}; 