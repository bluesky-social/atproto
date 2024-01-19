import { InvalidRequestError } from '@atproto/xrpc-server'
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
    const valid = /^\+[1-9]\d{1,14}$/.test(phoneNumber)
    if (!valid) {
      throw new InvalidRequestError('Invalid phone number')
    }
  }

  async sendCode(phoneNumber: string) {
    this.ensureValidPhoneNumber(phoneNumber)
    await this.verifyClient.verifications.create({
      to: phoneNumber,
      channel: 'sms',
    })
  }

  async verifyCode(phoneNumber: string, code: string) {
    this.ensureValidPhoneNumber(phoneNumber)
    const res = await this.verifyClient.verificationChecks.create({
      to: phoneNumber,
      code,
    })
    return res.status === 'approved'
  }
}
