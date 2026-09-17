import type { BrowserContext } from '@playwright/test';
import { config } from '../../config/environment';
import { PreconditionError } from '../../core/errors';
import { logger } from '../../core/logger';
import { WaitUtils } from '../../core/wait-utils';
import { alertMessages } from '../../data/static/messages';
import { UserFactory } from '../../data/factories/user.factory';
import type { AuthenticatedUser, UserCredentials } from '../../models/user.model';
import { StorageUtils } from '../../utils/storage-utils';
import type { AuthApiClient } from '../clients/auth-api.client';

/** Name of the cookie in which the application persists the session token. */
export const AUTH_COOKIE_NAME = 'tokenp_';

/**
 * API-based authentication preconditions. Establishing state through the API instead of
 * the UI is faster, immune to UI flakiness and keeps each test focused on the behaviour it
 * actually verifies.
 */
export class AuthPreconditions {
  private readonly log = logger.child({ scope: 'AuthPreconditions' });

  constructor(private readonly authApi: AuthApiClient) {}

  /** Registers the user if needed. Idempotent: an already existing account is not an error. */
  async ensureUserExists(user: UserCredentials): Promise<UserCredentials> {
    const result = await this.authApi.signUp(user);
    if (result.success) {
      this.log.info('Registered test user', { username: user.username });
      return user;
    }
    if (result.errorMessage === alertMessages.signUpExistingUser) {
      this.log.debug('Test user already exists', { username: user.username });
      return user;
    }
    throw new PreconditionError(
      `Could not register user "${user.username}": ${result.errorMessage ?? 'unknown error'}`
    );
  }

  /** Logs in through the API and returns a session token that the backend already recognises. */
  async obtainToken(user: UserCredentials): Promise<string> {
    const result = await this.authApi.login(user);
    if (!result.success || !result.token) {
      throw new PreconditionError(
        `Could not log in as "${user.username}": ${result.errorMessage ?? 'no token returned'}`
      );
    }
    const token = result.token;
    // The backend is eventually consistent: a token can be issued slightly before `/check`
    // (which the UI calls on every page load) is able to resolve it. Confirm before handing it out.
    await WaitUtils.forValue(
      () => this.authApi.checkToken(token),
      check => check.valid,
      {
        timeout: 10_000,
        interval: 300,
        message: `Session token for "${user.username}" was not accepted by /check`,
      }
    );
    return token;
  }

  /**
   * Makes the browser context authenticated by injecting the session cookie exactly as the
   * UI would. The next navigation renders the logged-in header.
   */
  async authenticateContext(
    context: BrowserContext,
    user: UserCredentials
  ): Promise<AuthenticatedUser> {
    const token = await this.obtainToken(user);
    await StorageUtils.setCookie(context, {
      name: AUTH_COOKIE_NAME,
      value: token,
      url: config.baseUrl,
    });
    this.log.info('Injected session cookie into browser context', { username: user.username });
    return { ...user, token };
  }

  /** Creates a brand-new account (or reuses `user`) and authenticates the context with it. */
  async createAuthenticatedUser(
    context: BrowserContext,
    user: UserCredentials = UserFactory.unique()
  ): Promise<AuthenticatedUser> {
    await this.ensureUserExists(user);
    return this.authenticateContext(context, user);
  }
}
