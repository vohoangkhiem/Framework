/** Payload for POST /signup and POST /login. The password is Base64 (UTF-8) encoded, as the UI does. */
export interface CredentialsRequest {
  username: string;
  password: string;
}

export interface SignUpResult {
  success: boolean;
  /** Present when the account already exists or the request was rejected. */
  errorMessage?: string;
}

export interface LoginResult {
  success: boolean;
  /** Session token extracted from the "Auth_token: <token>" response body. */
  token?: string;
  errorMessage?: string;
}

export interface CheckTokenRequest {
  token: string;
}

export interface CheckTokenResult {
  valid: boolean;
  username?: string;
  errorMessage?: string;
}
