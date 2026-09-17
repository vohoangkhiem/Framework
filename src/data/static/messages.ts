/**
 * Application messages surfaced through native dialogs and confirmation modals.
 * Centralised so that a copy change in the product is a one-line fix in the framework.
 */
export const alertMessages = {
  loginUserNotFound: 'User does not exist.',
  loginWrongPassword: 'Wrong password.',
  loginEmptyFields: 'Please fill out Username and Password.',
  signUpSuccess: 'Sign up successful.',
  signUpExistingUser: 'This user already exist.',
  signUpEmptyFields: 'Please fill out Username and Password.',
  /** Alert shown to anonymous shoppers. */
  productAddedAnonymous: 'Product added',
  /** The application appends a period only when the shopper is logged in. */
  productAddedLoggedIn: 'Product added.',
  /** Accepts both variants; use it when the session state is not the subject of the test. */
  productAdded: /^Product added\.?$/,
  purchaseSuccess: 'Thank you for your purchase!',
  orderValidationError: 'Please fill out Name and Creditcard.',
  tokenExpired: 'Your token has expired, please login again.',
} as const;

export const uiText = {
  welcomePrefix: 'Welcome ',
  cartTotalPrefix: 'Total: ',
} as const;
