export { default as resetPassword } from './templates/reset-password.js'
export { default as deleteAccount } from './templates/delete-account.js'
export { default as confirmEmail } from './templates/confirm-email.js'
export { default as updateEmail } from './templates/update-email.js'
export { default as plcOperation } from './templates/plc-operation.js'

/**
 * Common config variable that will be injected into all templates.
 */
export type Config = {
  serviceName: string
  homeUrl: string
  logoUrl: string
  markUrl: string
  primaryColor: string
  showBskyAppEmailConfirmationLink: boolean
}
