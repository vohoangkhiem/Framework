import { step } from '../core/step.decorator';
import { UserFactory } from '../data/factories/user.factory';
import type { UserCredentials } from '../models/user.model';
import type { LoginPage } from '../pages/login.page';
import type { SignUpPage } from '../pages/signup.page';

/**
 * UI-driven authentication journeys. Prefer `AuthPreconditions` (API) when authentication is
 * merely a precondition; use this workflow when the sign-up / login UI itself is under test.
 */
export class AuthWorkflow {
  constructor(
    private readonly signUpPage: SignUpPage,
    private readonly loginPage: LoginPage
  ) {}

  @step('Register a new user through the UI')
  async registerNewUser(user: UserCredentials = UserFactory.unique()): Promise<UserCredentials> {
    await this.signUpPage.signUpExpectingSuccess(user);
    return user;
  }

  @step('Register and log in through the UI')
  async signUpAndLogin(user: UserCredentials = UserFactory.unique()): Promise<UserCredentials> {
    await this.registerNewUser(user);
    await this.loginPage.login(user);
    await this.loginPage.expectLoginSuccess(user.username);
    return user;
  }

  @step('Log in through the UI as "{0}"')
  async loginAs(user: UserCredentials): Promise<void> {
    await this.loginPage.login(user);
    await this.loginPage.expectLoginSuccess(user.username);
  }

  @step('Log out through the UI')
  async logout(): Promise<void> {
    await this.loginPage.header.logout();
  }
}
