import { AUTH_COOKIE_NAME } from '@api/preconditions/auth.preconditions';
import { TAGS, tags } from '@config/test-tags';
import { alertMessages } from '@data/static/messages';
import { invalidLoginTestCases, validLoginTestCases } from '@data/test-cases/auth.test-cases';
import { expect, test } from '@fixtures';
import { StorageUtils } from '@utils/storage-utils';

test.describe('Login', tags(TAGS.ui, TAGS.auth), () => {
  test.beforeEach(async ({ homePage }) => {
    await homePage.goto();
  });

  test.describe('with valid credentials', tags(TAGS.smoke, TAGS.regression), () => {
    for (const testCase of validLoginTestCases) {
      test(testCase.description, async ({ loginPage, authPreconditions, context, logger }) => {
        // Precondition through the API: fast, isolated and independent of the sign-up UI.
        const user = await authPreconditions.ensureUserExists(testCase.createUser());
        logger.info('Registered user through API precondition', { username: user.username });

        await loginPage.login(user);
        await loginPage.expectLoginSuccess(user.username);

        const sessionCookie = await StorageUtils.getCookieValue(context, AUTH_COOKIE_NAME);
        expect(sessionCookie, 'session cookie should be persisted after login').toBeTruthy();
      });
    }

    test('keeps the user logged in after a page reload', async ({
      loginPage,
      homePage,
      authPreconditions,
      testData,
    }) => {
      const user = await authPreconditions.ensureUserExists(testData.users.unique());

      await loginPage.login(user);
      await loginPage.expectLoginSuccess(user.username);

      await homePage.reload();
      await homePage.header.expectLoggedIn(user.username);
    });

    test('logs out and returns to the anonymous state', async ({
      loginPage,
      authPreconditions,
      testData,
      context,
    }) => {
      const user = await authPreconditions.ensureUserExists(testData.users.unique());
      await loginPage.login(user);
      await loginPage.expectLoginSuccess(user.username);

      await loginPage.header.logout();

      await loginPage.header.expectLoggedOut();
      expect(
        await StorageUtils.getCookieValue(context, AUTH_COOKIE_NAME),
        'session cookie should be cleared'
      ).toBeFalsy();
    });

    test('recognises a session established through the API', async ({
      homePage,
      authenticatedUser,
    }) => {
      // Fixtures used only by the test body are created after `beforeEach`, so the first
      // navigation happened before the cookie was injected: load the page again with it.
      await homePage.reload();
      await homePage.header.expectLoggedIn(authenticatedUser.username);
    });
  });

  test.describe('with invalid credentials', tags(TAGS.negative, TAGS.regression), () => {
    for (const testCase of invalidLoginTestCases) {
      test(testCase.description, async ({ loginPage, sharedUser }) => {
        const alertMessage = await loginPage.loginExpectingAlert(testCase.credentials(sharedUser));

        expect(alertMessage).toBe(testCase.expectedMessage);
        await loginPage.expectLoginFailed();
      });
    }
  });

  test.describe('edge cases', tags(TAGS.edgeCase, TAGS.regression), () => {
    test('can be dismissed without submitting the form', async ({ loginPage, testData }) => {
      await loginPage.open();
      await loginPage.fillCredentials(testData.users.unregistered());

      await loginPage.close();

      await loginPage.expectLoginFailed();
    });

    test('stays open and shows the API error when the login service rejects the user', async ({
      loginPage,
      routeMocker,
      testData,
    }) => {
      // Deterministic negative path: the login API is mocked, so the test never depends on server state.
      await routeMocker.mockJson('**/login', { errorMessage: alertMessages.loginWrongPassword });

      const alertMessage = await loginPage.loginExpectingAlert(testData.users.unregistered());

      expect(alertMessage).toBe(alertMessages.loginWrongPassword);
      await loginPage.modal.expectOpen();
      await loginPage.expectLoginFailed();
      expect(routeMocker.interceptedCalls('/login')).toHaveLength(1);
    });

    test('trims nothing: a username with surrounding spaces is treated as a different user', async ({
      loginPage,
      sharedUser,
    }) => {
      const alertMessage = await loginPage.loginExpectingAlert({
        username: ` ${sharedUser.username} `,
        password: sharedUser.password,
      });

      expect(alertMessage).toBe(alertMessages.loginUserNotFound);
      await loginPage.expectLoginFailed();
    });
  });
});
