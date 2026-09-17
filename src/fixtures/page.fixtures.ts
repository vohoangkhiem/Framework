import { test as base, type Page } from '@playwright/test';
import { NetworkRecorder } from '../api/interceptors/network-recorder';
import { RouteMocker } from '../api/mocks/route-mocker';
import { CartPage } from '../pages/cart.page';
import { HomePage } from '../pages/home.page';
import { LoginPage } from '../pages/login.page';
import { PlaceOrderPage } from '../pages/place-order.page';
import { ProductPage } from '../pages/product.page';
import { SignUpPage } from '../pages/signup.page';
import { AuthWorkflow } from '../workflows/auth.workflow';
import { CartWorkflow } from '../workflows/cart.workflow';

export interface PageFixtures {
  homePage: HomePage;
  loginPage: LoginPage;
  signUpPage: SignUpPage;
  productPage: ProductPage;
  cartPage: CartPage;
  placeOrderPage: PlaceOrderPage;
  authWorkflow: AuthWorkflow;
  cartWorkflow: CartWorkflow;
  /** Declarative request mocking; all routes are removed after the test. */
  routeMocker: RouteMocker;
  /** Passive network recorder started before the test; log attached to the report on failure. */
  networkRecorder: NetworkRecorder;
}

type PageObjectConstructor<T> = new (page: Page) => T;

function pageObjectFixture<T>(PageObject: PageObjectConstructor<T>) {
  return async ({ page }: { page: Page }, use: (fixture: T) => Promise<void>): Promise<void> => {
    await use(new PageObject(page));
  };
}

/** Page objects, workflows and network tooling, all lazily created per test. */
export const pageTest = base.extend<PageFixtures>({
  homePage: pageObjectFixture(HomePage),
  loginPage: pageObjectFixture(LoginPage),
  signUpPage: pageObjectFixture(SignUpPage),
  productPage: pageObjectFixture(ProductPage),
  cartPage: pageObjectFixture(CartPage),
  placeOrderPage: pageObjectFixture(PlaceOrderPage),

  authWorkflow: async ({ signUpPage, loginPage }, use) => {
    await use(new AuthWorkflow(signUpPage, loginPage));
  },

  cartWorkflow: async ({ homePage, productPage, cartPage, placeOrderPage }, use) => {
    await use(new CartWorkflow(homePage, productPage, cartPage, placeOrderPage));
  },

  routeMocker: async ({ page }, use) => {
    const mocker = new RouteMocker(page);
    await use(mocker);
    await mocker.unrouteAll();
  },

  networkRecorder: async ({ page }, use, testInfo) => {
    const recorder = new NetworkRecorder(page, { resourceTypes: ['xhr', 'fetch'] }).start();
    await use(recorder);
    recorder.stop();
    if (testInfo.status !== testInfo.expectedStatus) {
      await recorder.attach(testInfo);
    }
  },
});
