import type { UserCredentials } from '../../models/user.model';
import { CHARSETS, RandomUtils } from '../../utils/random-utils';

/**
 * Fluent builder for user credentials. Defaults produce a globally unique username so that
 * sign-up preconditions never collide across parallel workers, browsers or CI retries.
 */
export class UserBuilder {
  private username: string = RandomUtils.uniqueId('qa_', 6);
  private password: string = RandomUtils.alphanumeric(12);

  static aUser(): UserBuilder {
    return new UserBuilder();
  }

  withUsername(username: string): this {
    this.username = username;
    return this;
  }

  withPassword(password: string): this {
    this.password = password;
    return this;
  }

  /** Unique username padded with random characters up to `length`. */
  withUsernameLength(length: number): this {
    const base = RandomUtils.uniqueId('qa_', 4);
    this.username =
      length <= base.length
        ? base.slice(0, length)
        : base + RandomUtils.alphanumeric(length - base.length);
    return this;
  }

  withPasswordLength(length: number): this {
    this.password = RandomUtils.alphanumeric(length);
    return this;
  }

  withSpecialCharacterPassword(length = 14): this {
    this.password = RandomUtils.password(length);
    return this;
  }

  withUnicodePassword(): this {
    this.password = `Pässw0rd-${RandomUtils.string(4, CHARSETS.alphaLower)}-日本`;
    return this;
  }

  withEmptyUsername(): this {
    this.username = '';
    return this;
  }

  withEmptyPassword(): this {
    this.password = '';
    return this;
  }

  build(): UserCredentials {
    return { username: this.username, password: this.password };
  }
}
