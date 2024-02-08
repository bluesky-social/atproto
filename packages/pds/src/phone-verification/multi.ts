import Database from '../db'
import { PlivoClient } from './plivo'
import { TwilioClient } from './twilio'
import { SECOND } from '@atproto/common'
import { randomIntFromSeed } from '@atproto/crypto'
import { PhoneVerifier } from './util'
import { InvalidRequestError } from '@atproto/xrpc-server'

const PLIVO_RATIO_FLAG = 'phone-verification:plivoRatio'
const SECOND_TRY_FLAG = 'phone-verification:attemptSecondTry'

export class MultiVerifier implements PhoneVerifier {
  plivoRatio = 0
  attemptSecondTry = false
  lastRefreshed = 0

  constructor(
    public db: Database,
    public twilio: TwilioClient,
    public plivo: PlivoClient,
  ) {}

  async checkRefreshRatio() {
    if (Date.now() - this.lastRefreshed > 30 * SECOND) {
      await this.refreshRatio()
    }
  }

  async refreshRatio() {
    const res = await this.db.db
      .selectFrom('runtime_flag')
      .where('name', '=', PLIVO_RATIO_FLAG)
      .orWhere('name', '=', SECOND_TRY_FLAG)
      .selectAll()
      .execute()

    this.plivoRatio = parseMaybeInt(
      res.find((val) => val.name === PLIVO_RATIO_FLAG)?.value,
    )
    this.attemptSecondTry =
      res.find((val) => val.name === SECOND_TRY_FLAG)?.value === 'true'

    this.lastRefreshed = Date.now()
  }

  async sendCode(phoneNumber: string) {
    await this.checkRefreshRatio()
    const id = await randomIntFromSeed(phoneNumber, 10, 0)
    if (id < this.plivoRatio) {
      await this.plivo.sendCode(phoneNumber)
    } else {
      await this.twilio.sendCode(phoneNumber)
    }
  }

  async verifyCode(phoneNumber: string, code: string) {
    await this.checkRefreshRatio()
    const id = await randomIntFromSeed(phoneNumber, 10, 0)
    const firstTry =
      id < this.plivoRatio
        ? () => this.plivo.verifyCode(phoneNumber, code)
        : () => this.twilio.verifyCode(phoneNumber, code)
    const secondTry =
      id < this.plivoRatio
        ? () => this.twilio.verifyCode(phoneNumber, code)
        : () => this.plivo.verifyCode(phoneNumber, code)
    try {
      const verified = await firstTry()
      if (!verified) {
        throw new InvalidRequestError(
          'Could not verify phone number. Please try again.',
          'InvalidPhoneVerification',
        )
      }
      return verified
    } catch (err) {
      if (this.attemptSecondTry) {
        return await secondTry()
      } else {
        throw err
      }
    }
  }
}

const parseMaybeInt = (str?: string): number => {
  if (!str) return 0
  const parsed = parseInt(str)
  if (isNaN(parsed) || parsed < 0) {
    return 0
  }
  return parsed
}
