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
