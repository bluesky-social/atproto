import * as ui8 from 'uint8arrays'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { plivoLogger as log } from '../logger'
import Database from '../db'
import { excluded } from '../db/util'

type Opts = {
  authId: string
  authToken: string
  appId: string
}

export class PlivoClient {
  authId: string
  appId: string
  private authorization: string

  constructor(public db: Database, opts: Opts) {
    this.authId = opts.authId
    this.appId = opts.appId
    this.authorization =
      'Basic ' +
      ui8.toString(
        ui8.fromString(`${opts.authId}:${opts.authToken}`, 'utf8'),
        'base64pad',
      )
  }

  async sendCode(phoneNumber: string) {
    try {
      // @NOTE: the trailing slash on the url is necessary
      const res = await this.makeReq(
        `https://api.plivo.com/v1/Account/${this.authId}/Verify/Session/`,
        {
          app_uuid: this.appId,
          recipient: phoneNumber,
          channel: 'sms',
        },
      )
      const sessionId = res['session_uuid']
      if (!sessionId) {
        throw new Error('no session id recieved')
      }
      await this.db.db
        .insertInto('plivo_session')
        .values({
          phoneNumber,
          sessionId,
          createdAt: new Date().toISOString(),
        })
        .onConflict((oc) =>
          oc.doUpdateSet({
            sessionId: excluded(this.db.db, 'sessionId'),
            createdAt: excluded(this.db.db, 'createdAt'),
          }),
        )
        .execute()
    } catch (err) {
      log.error({ err, phoneNumber }, 'error sending plivo code')
      throw new InvalidRequestError('Could not send verification text')
    }
  }

  async verifyCode(phoneNumber: string, code: string) {
    const res = await this.db.db
      .selectFrom('plivo_session')
      .selectAll()
      .where('phoneNumber', '=', phoneNumber)
      .executeTakeFirst()
    if (!res) {
      throw new InvalidRequestError(
        'No verification session exists. Please try again',
        'InvalidPhoneVerification',
      )
    }

    const sessionId = res.sessionId

    try {
      // @NOTE: the trailing slash on the url is necessary
      await this.makeReq(
        `https://api.plivo.com/v1/Account/${this.authId}/Verify/Session/${sessionId}/`,
        {
          OTP: code,
        },
      )
      return true
    } catch (err) {
      log.error(
        { err, phoneNumber, sessionId, code },
        'error sending plivo code',
      )
      throw new InvalidRequestError(
        'Could not verify code. Please try again',
        'InvalidPhoneVerification',
      )
    }
  }

  private async makeReq(url: string, body: Record<string, unknown>) {
    const reqInit: RequestInit & { duplex: 'half' } = {
      method: 'POST',
      headers: {
        authorization: this.authorization,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      duplex: 'half',
    }

    const res = await fetch(url, reqInit)

    if (res.status >= 400) {
      let err: string
      if (res.headers.get('content-type')?.startsWith('application/json')) {
        const body = await res.json()
        err = body['error'] ?? body['message']
      } else {
        err = await res.text()
      }
      throw new Error(err)
    }

    return await res.json()
  }
}
