import type { SendMailOptions, Transporter } from 'nodemailer'
import { htmlToText } from 'nodemailer-html-to-text'
import type { ServerConfig } from '../config/index.js'
import { mailerLogger } from '../logger.js'

export class ModerationMailer {
  private config: ServerConfig
  transporter: Transporter

  constructor(transporter: Transporter, config: ServerConfig) {
    this.config = config
    this.transporter = transporter
    this.transporter.use('compile', htmlToText())
  }

  async send({ content }: { content: string }, mailOpts: SendMailOptions) {
    const mail = {
      ...mailOpts,
      html: content,
      from: this.config.moderationEmail?.fromAddress,
    }

    const res = await this.transporter.sendMail(mail)

    if (!this.config.moderationEmail?.smtpUrl) {
      mailerLogger.debug(
        'Moderation email auth is not configured. Intended to send email:\n' +
          JSON.stringify(res, null, 2),
      )
    }
    return res
  }
}
