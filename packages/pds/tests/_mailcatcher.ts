import { EventEmitter, once } from 'node:events'
import type { SendMailOptions, Transporter } from 'nodemailer'
import type { ServerMailer } from '../src/mailer/index.js'

type ExtractMethodNames<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any ? K : never
}[keyof T]
type ExtractMethods<T> = Pick<T, ExtractMethodNames<T>>

export class MailCatcher extends EventEmitter {
  private transporter: Transporter
  private originalSendMail: ExtractMethods<Transporter>['sendMail']

  constructor(mailer: ServerMailer) {
    super()

    this.transporter = mailer.transporter
    this.originalSendMail = this.transporter.sendMail.bind(this.transporter)

    this.transporter.sendMail = async (opts) => {
      const result = await this.originalSendMail.call(this.transporter, opts)
      this.emit('mail', opts)
      return result
    }
  }

  async restore() {
    this.transporter.sendMail = this.originalSendMail
  }

  async getMailFrom<T>(
    promise: Promise<T>,
  ): Promise<{ mail: SendMailOptions; result: any }> {
    const result = await Promise.all([once(this, 'mail'), promise])
    return {
      mail: result[0][0],
      result: result[1],
    }
  }

  getTokenFromMail(mail: SendMailOptions) {
    return mail.html?.toString().match(/>([a-z0-9]{5}-[a-z0-9]{5})</i)?.[1]
  }
}
