import { InvalidRequestError, UpstreamFailureError } from '@atproto/xrpc-server'
import twilio from 'twilio'

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

  ensureValidPhoneNumber(phoneNumber: string) {
    // https://www.twilio.com/docs/glossary/what-e164#regex-matching-for-e164
    const valid = /^\+[1-9]\d{1,14}$/.test(phoneNumber)
    if (!valid) {
      throw new InvalidRequestError('Invalid phone number')
    }
  }

  async sendCode(phoneNumber: string) {
    this.ensureValidPhoneNumber(phoneNumber)
    try {
      await this.verifyClient.verifications.create({
        to: phoneNumber,
        channel: 'sms',
      })
    } catch (err) {
      throw new UpstreamFailureError('Could not send verification text')
    }
  }

  async verifyCode(phoneNumber: string, code: string) {
    this.ensureValidPhoneNumber(phoneNumber)
    try {
      const res = await this.verifyClient.verificationChecks.create({
        to: phoneNumber,
        code,
      })
      return res.status === 'approved'
    } catch (err) {
      throw new UpstreamFailureError('Could not send verification text')
    }
  }
}
