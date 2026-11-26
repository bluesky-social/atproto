import { jest } from '@jest/globals'
import type { Transporter } from 'nodemailer'
import type { BrandingConfig, EmailConfig } from '../config/index.js'
import { ServerMailer } from './index.js'

const makeMailer = (email: EmailConfig | null) => {
  const sendMail = jest.fn(async () => ({}))
  const transporter = { use: jest.fn(), sendMail }
  const mailer = new ServerMailer(
    transporter as unknown as Transporter,
    email,
    {} as BrandingConfig,
    'https://pds.example.com',
  )
  return { mailer, sendMail }
}

const emailConfig = (overrides: Partial<EmailConfig> = {}): EmailConfig => ({
  smtpUrl: 'smtp://localhost:25',
  fromAddress: 'noreply@example.com',
  disableConfirmationLink: false,
  ...overrides,
})

const sentHtml = (sendMail: ReturnType<typeof jest.fn>) => {
  const call = sendMail.mock.calls[0]?.[0] as { html?: string } | undefined
  return (call?.html ?? '').replaceAll('&#x3D;', '=').replaceAll('&#x26;', '&')
}

describe('ServerMailer', () => {
  describe('sendConfirmEmail', () => {
    it('links to bsky.app by default', async () => {
      const { mailer, sendMail } = makeMailer(emailConfig())
      await mailer.sendConfirmEmail({ token: 'tok123' }, { to: 'u@e.com' })
      expect(sentHtml(sendMail)).toContain(
        'https://bsky.app/intent/verify-email?code=tok123',
      )
    })

    it('uses the configured confirmation url with the token substituted', async () => {
      const { mailer, sendMail } = makeMailer(
        emailConfig({
          confirmationUrl: 'https://app.example.com/verify-email?code={token}',
        }),
      )
      await mailer.sendConfirmEmail({ token: 'tok123' }, { to: 'u@e.com' })
      const html = sentHtml(sendMail)
      expect(html).toContain('https://app.example.com/verify-email?code=tok123')
      expect(html).not.toContain('bsky.app/intent/verify-email')
    })

    it('omits the confirmation link when disabled', async () => {
      const { mailer, sendMail } = makeMailer(
        emailConfig({ disableConfirmationLink: true }),
      )
      await mailer.sendConfirmEmail({ token: 'tok123' }, { to: 'u@e.com' })
      expect(sentHtml(sendMail)).not.toContain('verify-email?code=')
    })
  })
})
