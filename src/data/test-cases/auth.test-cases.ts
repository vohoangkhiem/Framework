import type { UserCredentials } from '../../models/user.model';
import { UserBuilder } from '../builders/user.builder';
import { UserFactory } from '../factories/user.factory';
import { alertMessages } from '../static/messages';

/**
 * Credentials are produced lazily (factory functions) so that every test invocation,
 * browser project and retry registers its own fresh account.
 */
export interface ValidLoginTestCase {
  description: string;
  createUser: () => UserCredentials;
}

/**
 * Negative cases derive from the shared account (which the `setup` project guarantees to
 * exist) so that "wrong password" is a genuine wrong password rather than an unknown user.
 */
export interface InvalidLoginTestCase {
  description: string;
  credentials: (existingUser: UserCredentials) => UserCredentials;
  expectedMessage: string;
}

export const validLoginTestCases: readonly ValidLoginTestCase[] = [
  {
    description: 'logs in with a freshly registered user',
    createUser: () => UserFactory.unique(),
  },
  {
    description: 'logs in with a 30-character username',
    createUser: () => UserBuilder.aUser().withUsernameLength(30).build(),
  },
  {
    description: 'logs in with a 30-character password',
    createUser: () => UserBuilder.aUser().withPasswordLength(30).build(),
  },
  {
    description: 'logs in with a password containing special characters',
    createUser: () => UserFactory.withSpecialCharacterPassword(),
  },
];

export const invalidLoginTestCases: readonly InvalidLoginTestCase[] = [
  {
    description: 'rejects an incorrect password for an existing user',
    credentials: existing => ({
      username: existing.username,
      password: `${existing.password}-wrong`,
    }),
    expectedMessage: alertMessages.loginWrongPassword,
  },
  {
    description: 'rejects a username that does not exist',
    credentials: existing => ({
      username: UserFactory.unregistered().username,
      password: existing.password,
    }),
    expectedMessage: alertMessages.loginUserNotFound,
  },
  {
    description: 'rejects an empty username',
    credentials: existing => ({ username: '', password: existing.password }),
    expectedMessage: alertMessages.loginEmptyFields,
  },
  {
    description: 'rejects an empty password',
    credentials: existing => ({ username: existing.username, password: '' }),
    expectedMessage: alertMessages.loginEmptyFields,
  },
  {
    description: 'rejects empty username and password',
    credentials: () => ({ username: '', password: '' }),
    expectedMessage: alertMessages.loginEmptyFields,
  },
  {
    description: 'treats username as case-sensitive',
    credentials: existing => ({
      username: existing.username.toUpperCase(),
      password: existing.password,
    }),
    expectedMessage: alertMessages.loginUserNotFound,
  },
];
