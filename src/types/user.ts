export interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
  metadata: {
    roles?: string[];
    attributes?: Record<string, any>;
  };
} 