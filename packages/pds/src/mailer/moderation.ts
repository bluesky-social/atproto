import { Transporter } from 'nodemailer'
import Mail from 'nodemailer/lib/mailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import { htmlToText } from 'nodemailer-html-to-text'
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
    this.transporter.use('compile', htmlToText())
  }

  async send({ content }: { content: string }, mailOpts: Mail.Options) {
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
