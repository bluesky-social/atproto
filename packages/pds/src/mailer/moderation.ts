import { Transporter } from 'nodemailer'
import Mail from 'nodemailer/lib/mailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import { ServerConfig } from '../config'
import { mailerLogger } from '../logger'

export class ModerationMailer {
  private config: ServerConfig
  transporter: Transporter<SMTPTransport.SentMessageInfo>

  constructor(
    transporter: Transporter<SMTPTransport.SentMessageInfo>,
    config: ServerConfig,
  ) {
    this.config = config
    this.transporter = transporter
  }

  async send({ content }: { content: string }, mailOpts: Mail.Options) {
    const res = await this.transporter.sendMail({
      ...mailOpts,
      text: content,
      from: this.config.moderationEmailAddress,
    })

    if (!this.config.moderationEmailSmtpUrl) {
      mailerLogger.debug(
        'Moderation email auth is not configured. Intended to send email:\n' +
          JSON.stringify(res, null, 2),
      )
    }
    return res
  }
}
