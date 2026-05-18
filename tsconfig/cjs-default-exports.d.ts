/**
 * Module declarations for CJS packages that use `export default` but don't
 * resolve correctly under Node16 module resolution. These packages set
 * `__esModule = true` and `exports.default = ...` in their CJS output, but
 * TypeScript's Node16 resolution doesn't interpret the default import correctly.
 */

declare module 'nodemailer/lib/mailer' {
  namespace Mail {
    interface Options {
      from?: string | { name?: string; address: string }
      to?: string | string[]
      subject?: string
      text?: string
      html?: string
      [key: string]: any
    }
  }
  class Mail {
    constructor(transporter: any)
  }
  export = Mail
}
