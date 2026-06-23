import { SendMailOptions, Transporter } from 'nodemailer'
import { htmlToText } from 'nodemailer-html-to-text'
import { BrandingConfig, EmailConfig } from '../config/index.js'
import { mailerLogger } from '../logger.js'
import * as templates from './templates.js'

// @TODO Add support for i18n

const DEFAULT_LOGO_URL =
  'https://bsky.social/about/images/email/email_logo_default.png'
const DEFAULT_MARK_URL =
  'https://bsky.social/about/images/email/email_mark_dark.png'
const DEFAULT_HOME_URL = 'https://bsky.app'
const DEFAULT_PRIMARY_COLOR = '#067df7'

export class ServerMailer {
  private readonly config: templates.Config

  constructor(
    public readonly transporter: Transporter,
    private readonly email: EmailConfig | null,
    branding: BrandingConfig,
  ) {
    transporter.use('compile', htmlToText())

    this.config = {
      serviceName: branding.name ?? 'Bluesky',
      homeUrl:
        branding.links?.find((link) => link.rel === 'canonical')?.href ??
        DEFAULT_HOME_URL,
      logoUrl: branding.logo ?? DEFAULT_LOGO_URL,
      markUrl: branding.logo ?? DEFAULT_MARK_URL,
      primaryColor: branding.colors?.primary ?? DEFAULT_PRIMARY_COLOR,
      showBskyAppEmailConfirmationLink: email?.disableConfirmationLink !== true,
    }
  }

  async sendResetPassword(
    params: { handle: string; token: string; locale?: string },
    mailOpts: SendMailOptions,
  ) {
    // @TODO (later) handle locale in the template
    await this.sendTemplate('resetPassword', params, {
      subject: 'Password Reset Requested',
      ...mailOpts,
    })
  }

  async sendAccountDelete(
    params: { token: string; locale?: string },
    mailOpts: SendMailOptions,
  ) {
    // @TODO (later) handle locale in the template
    await this.sendTemplate('deleteAccount', params, {
      subject: 'Account Deletion Requested',
      ...mailOpts,
    })
  }

  async sendConfirmEmail(
    params: { token: string; locale?: string },
    mailOpts: SendMailOptions,
  ) {
    // @TODO (later) handle locale in the template
    await this.sendTemplate('confirmEmail', params, {
      subject: 'Email Confirmation',
      ...mailOpts,
    })
  }

  async sendUpdateEmail(
    params: { token: string; locale?: string },
    mailOpts: SendMailOptions,
  ) {
    // @TODO (later) handle locale in the template
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
      config: this.config,
    } as any)
    const res = await this.transporter.sendMail({
      ...mailOpts,
      from: mailOpts.from ?? this.email?.fromAddress,
      html,
    })
    if (!this.email?.smtpUrl) {
      mailerLogger.debug(
        'No SMTP URL has been configured. Intended to send email:\n' +
          JSON.stringify(res, null, 2),
      )
    }
    return res
  }
}
