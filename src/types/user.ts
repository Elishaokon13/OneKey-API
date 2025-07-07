export interface User {
  id: string;
  email: string;
  wallet_address?: string;
  passkey_id?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
  metadata: {
    roles?: string[];
    attributes?: Record<string, any>;
  };
} 