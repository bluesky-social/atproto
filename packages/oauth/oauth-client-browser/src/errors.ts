/**
 * Special error class destined to be thrown when the login process was
 * performed in a popup and should be continued in the parent/initiating window.
 */
export class LoginContinuedInParentWindowError extends Error {
  code = 'LOGIN_CONTINUED_IN_PARENT_WINDOW'
  constructor() {
    super('Login complete, please close the popup window.')
  }
}
