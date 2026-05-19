import { SendMailOptions, Transporter } from 'nodemailer'
import { htmlToText } from 'nodemailer-html-to-text'
import { ServerConfig } from '../config/index.js'
import { mailerLogger } from '../logger.js'
import * as templates from './templates.js'

// @TODO Add support for i18n

export class ServerMailer {
  constructor(
    public readonly transporter: Transporter,
    private readonly config: ServerConfig,
  ) {
    transporter.use('compile', htmlToText())
  }

  // The returned config can be used inside email templates.
  static getEmailConfig(_config: ServerConfig) {
    return {}
  }

  async sendResetPassword(
    params: { handle: string; token: string },
    mailOpts: SendMailOptions,
  ) {
    await this.sendTemplate('resetPassword', params, {
      subject: 'Password Reset Requested',
      ...mailOpts,
    })
  }

  async sendAccountDelete(
    params: { token: string },
    mailOpts: SendMailOptions,
  ) {
    await this.sendTemplate('deleteAccount', params, {
      subject: 'Account Deletion Requested',
      ...mailOpts,
    })
  }

  async sendConfirmEmail(params: { token: string }, mailOpts: SendMailOptions) {
    await this.sendTemplate('confirmEmail', params, {
      subject: 'Email Confirmation',
      ...mailOpts,
    })
  }

  async sendUpdateEmail(params: { token: string }, mailOpts: SendMailOptions) {
    await this.sendTemplate('updateEmail', params, {
      subject: 'Email Update Requested',
      ...mailOpts,
    })
  }

  async sendPlcOperation(params: { token: string }, mailOpts: SendMailOptions) {
    await this.sendTemplate('plcOperation', params, {
      subject: 'PLC Update Operation Requested',
      ...mailOpts,
    })
  }

  private async sendTemplate<K extends keyof typeof templates>(
    templateName: K,
    params: Parameters<(typeof templates)[K]>[0],
    mailOpts: SendMailOptions,
  ) {
    const html = templates[templateName]({
      ...params,
      config: ServerMailer.getEmailConfig(this.config),
    } as any)
    const res = await this.transporter.sendMail({
      ...mailOpts,
      from: mailOpts.from ?? this.config.email?.fromAddress,
      html,
    })
    if (!this.config.email?.smtpUrl) {
      mailerLogger.debug(
        'No SMTP URL has been configured. Intended to send email:\n' +
          JSON.stringify(res, null, 2),
      )
    }
    return res
  }
}
