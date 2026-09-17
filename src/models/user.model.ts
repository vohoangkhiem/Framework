export interface UserCredentials {
  username: string;
  password: string;
}

export interface AuthenticatedUser extends UserCredentials {
  /** Session token issued by POST /login and persisted by the UI in the `tokenp_` cookie. */
  token: string;
}
