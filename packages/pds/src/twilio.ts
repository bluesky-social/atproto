import { InvalidRequestError, UpstreamFailureError } from '@atproto/xrpc-server'
import twilio from 'twilio'
import { twilioLogger as log } from './logger'

type Opts = {
  accountSid: string
  serviceSid: string
  authToken: string
}

type VerifyClient = ReturnType<twilio.Twilio['verify']['v2']['services']>

export class TwilioClient {
  verifyClient: VerifyClient

  constructor(opts: Opts) {
    this.verifyClient = twilio(
      opts.accountSid,
      opts.authToken,
    ).verify.v2.services(opts.serviceSid)
  }

  normalizePhoneNumber(phoneNumber: string) {
    let normalized = phoneNumber.trim().replaceAll(/\(|\)|-| /g, '')
    if (!normalized.startsWith('+')) {
      if (normalized.length === 10) {
        normalized = '+1' + normalized
      } else {
        normalized = '+' + normalized
      }
    }
    // https://www.twilio.com/docs/glossary/what-e164#regex-matching-for-e164
    const valid = /^\+[1-9]\d{1,14}$/.test(normalized)
    if (!valid) {
      throw new InvalidRequestError('Invalid phone number')
    }
    return normalized
  }

  async sendCode(phoneNumber: string) {
    try {
      await this.verifyClient.verifications.create({
        to: phoneNumber,
        channel: 'sms',
      })
    } catch (err) {
      log.error({ err, phoneNumber }, 'error sending twilio code')
      const code = typeof err === 'object' ? err?.['code'] : undefined
      if (code === 60200) {
        throw new InvalidRequestError(
          'Could not send verification text: invalid phone number',
        )
      } else if (code === 60605 || code === 60220) {
        throw new InvalidRequestError(
          `We're sorry, we're not currently able to send verification messages to your country. We're working with our providers to solve this as quickly as possible.`,
        )
      } else {
        throw new UpstreamFailureError('Could not send verification text')
      }
    }
  }

  async verifyCode(phoneNumber: string, code: string) {
    try {
      const res = await this.verifyClient.verificationChecks.create({
        to: phoneNumber,
        code,
      })
      return res.status === 'approved'
    } catch (err) {
      log.error({ err, phoneNumber, code }, 'error verifying twilio code')
      throw new UpstreamFailureError('Could not verify code. Please try again')
    }
  }
}
