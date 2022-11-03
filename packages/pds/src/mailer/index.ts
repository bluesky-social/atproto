import fs from 'fs'
import Handlebars from 'handlebars'
import { Transporter } from 'nodemailer'
import { htmlToText } from 'nodemailer-html-to-text'
import Mail from 'nodemailer/lib/mailer'
import SMTPTransport from 'nodemailer/lib/smtp-transport'
import { ServerConfig } from '../config'

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
    }
  }

  // The returned config can be used inside email templates.
  static getEmailConfig(config: ServerConfig) {
    return {
      appUrlPasswordReset: config.appUrlPasswordReset,
    }
  }

  async sendResetPassword(params: { token: string }, mailOpts: Mail.Options) {
    return this.sendTemplate('resetPassword', params, {
      subject: 'Password Reset Requested',
      ...mailOpts,
    })
  }

  private async sendTemplate(templateName, params, mailOpts: Mail.Options) {
    const html = this.templates[templateName]({
      ...params,
      config: ServerMailer.getEmailConfig(this.config),
    })
    return await this.transporter.sendMail({
      ...mailOpts,
      from: mailOpts.from ?? this.config.emailNoReplyAddress,
      html,
    })
  }

  private compile(name) {
    return this.handlebars.compile(
      fs.readFileSync(`${__dirname}/templates/${name}.hbs`).toString(),
    )
  }
}
