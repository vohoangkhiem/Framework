import { TAGS, tags } from '@config/test-tags';
import { alertMessages } from '@data/static/messages';
import { expect, test } from '@fixtures';

test.describe('Authentication API', tags(TAGS.api, TAGS.auth, TAGS.regression), () => {
  test('registers a new user', async ({ authApi, testData }) => {
    const result = await authApi.signUp(testData.users.unique());

    expect(result.success).toBe(true);
    expect(result.errorMessage).toBeUndefined();
  });

  test('rejects registering an existing username', async ({ authApi, testData }) => {
    const user = testData.users.unique();
    await authApi.signUp(user);

    const secondAttempt = await authApi.signUp(user);

    expect(secondAttempt.success).toBe(false);
    expect(secondAttempt.errorMessage).toBe(alertMessages.signUpExistingUser);
  });

  test('issues a session token for valid credentials that the check endpoint accepts', async ({
    authApi,
    authPreconditions,
    testData,
  }) => {
    const user = await authPreconditions.ensureUserExists(testData.users.unique());

    const login = await authApi.login(user);
    expect(login.success).toBe(true);
    expect(login.token).toBeTruthy();

    const check = await authApi.checkToken(login.token ?? '');
    expect(check.valid).toBe(true);
    expect(check.username).toBe(user.username);
  });

  test('rejects a wrong password', async ({ authApi, authPreconditions, testData }) => {
    const user = await authPreconditions.ensureUserExists(testData.users.unique());

    const login = await authApi.login({
      username: user.username,
      password: `${user.password}-wrong`,
    });

    expect(login.success).toBe(false);
    expect(login.errorMessage).toBe(alertMessages.loginWrongPassword);
  });

  test('rejects an unknown user', async ({ authApi, testData }) => {
    const login = await authApi.login(testData.users.unregistered());

    expect(login.success).toBe(false);
    expect(login.errorMessage).toBe(alertMessages.loginUserNotFound);
  });

  test('rejects a malformed token', async ({ authApi }) => {
    const check = await authApi.checkToken('not-a-real-token');

    expect(check.valid).toBe(false);
    expect(check.errorMessage).toBeTruthy();
  });

  test(
    'accepts passwords with unicode characters',
    tags(TAGS.edgeCase),
    async ({ authApi, testData }) => {
      const user = testData.builders.user().withUnicodePassword().build();
      await authApi.signUp(user);

      const login = await authApi.login(user);

      expect(login.success).toBe(true);
    }
  );
});
