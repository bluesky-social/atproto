/**
 * Special error class destined to be thrown when the login process was
 * performed in a popup and should be continued in the parent/initiating window.
 */
export class LoginContinuedInParentWindowError extends Error {
  constructor() {
    super('Login complete, please close the popup window.')
  }
}
