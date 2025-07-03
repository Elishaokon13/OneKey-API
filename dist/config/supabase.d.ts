import { SupabaseClient } from '@supabase/supabase-js';
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
export declare const initializeSupabase: () => void;
export declare const getSupabaseClient: () => SupabaseClient<Database>;
export declare const getSupabaseServiceClient: () => SupabaseClient<Database>;
export declare const checkSupabaseHealth: () => Promise<{
    status: string;
    details: {
        connected: boolean;
        publicClient: boolean;
        serviceClient: boolean;
        url?: string;
    };
}>;
export declare const subscribeToKycUpdates: (userId: string, callback: (payload: any) => void) => import("@supabase/supabase-js").RealtimeChannel;
export declare const isSupabaseConfigured: () => boolean;
export declare const closeSupabase: () => Promise<void>;
//# sourceMappingURL=supabase.d.ts.map