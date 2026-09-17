import type { APIRequestContext } from '@playwright/test';
import type { UserCredentials } from '../../models/user.model';
import { isRecord } from '../../utils/json-utils';
import { StringUtils } from '../../utils/string-utils';
import type { CheckTokenResult, LoginResult, SignUpResult } from '../models/auth.models';
import { BaseApiClient, type ApiClientOptions } from './base-api.client';

const AUTH_TOKEN_PREFIX = 'Auth_token: ';

/**
 * Client for the authentication endpoints. Note that the Demoblaze API signals business
 * errors with HTTP 200 + `{ errorMessage }`, so every method inspects the body rather than
 * relying on the status code alone.
 */
export class AuthApiClient extends BaseApiClient {
  constructor(request: APIRequestContext, options: ApiClientOptions = {}) {
    super(request, { name: 'AuthApi', ...options });
  }

  /** Mirrors the UI's `b64EncodeUnicode`: UTF-8 bytes encoded as Base64. */
  static encodePassword(password: string): string {
    return StringUtils.toBase64(password);
  }

  async signUp(user: UserCredentials): Promise<SignUpResult> {
    const response = await this.post('/signup', { data: AuthApiClient.toPayload(user) });
    await this.assertOk(response, 'POST', '/signup');
    const errorMessage = AuthApiClient.extractErrorMessage(await response.text());
    return errorMessage ? { success: false, errorMessage } : { success: true };
  }

  async login(user: UserCredentials): Promise<LoginResult> {
    const response = await this.post('/login', { data: AuthApiClient.toPayload(user) });
    await this.assertOk(response, 'POST', '/login');
    const text = await response.text();
    const errorMessage = AuthApiClient.extractErrorMessage(text);
    if (errorMessage) {
      return { success: false, errorMessage };
    }
    const token = AuthApiClient.extractToken(text);
    return token
      ? { success: true, token }
      : { success: false, errorMessage: `Unexpected login response: ${text}` };
  }

  async checkToken(token: string): Promise<CheckTokenResult> {
    const response = await this.post('/check', { data: { token } });
    await this.assertOk(response, 'POST', '/check');
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.Item) && typeof body.Item.username === 'string') {
      return { valid: true, username: body.Item.username };
    }
    return {
      valid: false,
      errorMessage: AuthApiClient.extractErrorMessage(JSON.stringify(body)) ?? 'Unknown response',
    };
  }

  private static toPayload(user: UserCredentials): { username: string; password: string } {
    return { username: user.username, password: AuthApiClient.encodePassword(user.password) };
  }

  private static extractErrorMessage(text: string): string | undefined {
    try {
      const parsed: unknown = JSON.parse(text);
      if (isRecord(parsed) && typeof parsed.errorMessage === 'string') {
        return parsed.errorMessage;
      }
    } catch {
      // Body is not JSON (e.g. an empty success response); fall through.
    }
    return undefined;
  }

  private static extractToken(text: string): string | undefined {
    // Successful login returns a JSON string: "Auth_token: <token>"
    const unquoted = text.trim().replace(/^"|"$/g, '');
    return unquoted.startsWith(AUTH_TOKEN_PREFIX)
      ? unquoted.slice(AUTH_TOKEN_PREFIX.length).trim()
      : undefined;
  }
}
