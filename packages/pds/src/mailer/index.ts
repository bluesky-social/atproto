import fs from 'fs'
import Handlebars from 'handlebars'
import { Transporter } from 'nodemailer'
import { htmlToText } from 'nodemailer-html-to-text'
import Mail from 'nodemailer/lib/mailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import { ServerConfig } from '../config'
import { mailerLogger } from '../logger'

export class ServerMailer {
  private config: ServerConfig
  transporter: Transporter<SMTPTransport.SentMessageInfo>
  handlebars: typeof Handlebars
  private templates: Record<string, Handlebars.TemplateDelegate<unknown>>

  constructor(
    transporter: Transporter<SMTPTransport.SentMessageInfo>,
    config: ServerConfig,
  ) {
    this.config = config
    this.transporter = transporter
    this.transporter.use('compile', htmlToText())
    this.handlebars = Handlebars.create()
    this.templates = {
      resetPassword: this.compile('reset-password'),
      deleteAccount: this.compile('delete-account'),
    }
  }

  // The returned config can be used inside email templates.
  static getEmailConfig(config: ServerConfig) {
    return {
      appUrlPasswordReset: config.appUrlPasswordReset,
    }
  }

  async sendResetPassword(
    params: { handle: string; token: string },
    mailOpts: Mail.Options,
  ) {
    return this.sendTemplate('resetPassword', params, {
      subject: 'Password Reset Requested',
      ...mailOpts,
    })
  }

  async sendAccountDelete(params: { token: string }, mailOpts: Mail.Options) {
    return this.sendTemplate('deleteAccount', params, {
      subject: 'Account Deletion Requested',
      ...mailOpts,
    })
  }

  private async sendTemplate(templateName, params, mailOpts: Mail.Options) {
    const html = this.templates[templateName]({
      ...params,
      config: ServerMailer.getEmailConfig(this.config),
    })
    const res = await this.transporter.sendMail({
      ...mailOpts,
      from: mailOpts.from ?? this.config.emailNoReplyAddress,
      html,
    })
    if (!this.config.emailSmtpUrl) {
      mailerLogger.debug(
        'No SMTP URL has been configured. Intended to send email:\n' +
          JSON.stringify(res, null, 2),
      )
    }
    return res
  }

  private compile(name) {
    return this.handlebars.compile(
      fs.readFileSync(`${__dirname}/templates/${name}.hbs`).toString(),
    )
  }
}
