import twilio from 'twilio'

type Opts = {
  accountSid: string
  serviceSid: string
  authToken: string
}

export class TwilioClient {
  client: twilio.Twilio
  serviceSid: string

  constructor(opts: Opts) {
    this.client = twilio(opts.accountSid, opts.authToken)
    this.serviceSid = opts.serviceSid
  }

  async sendCode(phoneNumber: string) {
    await this.client.verify.v2
      .services(this.serviceSid)
      .verifications.create({ to: phoneNumber, channel: 'sms' })
  }

  async verifyCode(phoneNumber: string, code: string) {
    const res = await this.client.verify.v2
      .services(this.serviceSid)
      .verificationChecks.create({ to: phoneNumber, code })
    return res.status === 'approved'
  }
}
