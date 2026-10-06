export type UserRole = "admin" | "officer" | "agent" | "user";

export interface User {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  bio: string | null;
  profile_url: string | null;
  role: UserRole;
  is_admin: boolean;
  is_officer: boolean;
  is_agent: boolean;
  is_active: boolean;
  suspend: boolean;
  is_superuser: boolean;
  is_staff: boolean;
  user_type_name?: string | null;
  directorate_id: string | null;
  directorate_name: string | null;
  county_id: string | null;
  county_name: string | null;
  permissions: string[];
  date_joined: string;
  last_login: string | null;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
}

export interface ChangePasswordPayload {
  current_password: string;
  new_password: string;
}

export interface ResetPasswordPayload {
  email: string;
  code: string;
  new_password: string;
}

export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  gender?: string;
  bio?: string;
}
