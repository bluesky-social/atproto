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

  async sendResetPassword(params: { token: string }, mailOpts: Mail.Options) {
    return this.sendTemplate('resetPassword', params, mailOpts)
  }

  private async sendTemplate(templateName, params, mailOpts: Mail.Options) {
    const template = this.templates[templateName]({
      ...params,
      config: this.config,
    })
    return await this.transporter.sendMail({
      ...mailOpts,
      from: mailOpts.from ?? this.config.emailNoReplyAddress,
      html: template,
    })
  }

  private compile(name) {
    return this.handlebars.compile(
      fs.readFileSync(`${__dirname}/templates/${name}.hbs`).toString(),
    )
  }
}
