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

  async sendCode(phoneNumber: string) {
    await this.verifyClient.verifications.create({
      to: phoneNumber,
      channel: 'sms',
    })
  }

  async verifyCode(phoneNumber: string, code: string) {
    const res = await this.verifyClient.verificationChecks.create({
      to: phoneNumber,
      code,
    })
    return res.status === 'approved'
  }
}
