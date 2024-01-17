import assert from 'assert'
import AtpAgent from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { AppContext } from '../src'

describe('phone verification', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent

  let verificationCodes: Record<string, string>
  let sentCodes: { number: string; code: string }[]

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'phone_verification',
      pds: {
        phoneVerificationRequired: true,
        twilioAccountSid: 'ACXXXXXXX',
        twilioAuthToken: 'AUTH',
        twilioServiceSid: 'VAXXXXXXXX',
      },
    })
    ctx = network.pds.ctx
    assert(ctx.twilio)
    verificationCodes = {}
    sentCodes = []
    ctx.twilio.sendCode = async (number: string) => {
      if (!verificationCodes[number]) {
        const code = crypto.randomStr(4, 'base10').slice(0, 6)
        verificationCodes[number] = code
      }
      const code = verificationCodes[number]
      sentCodes.push({ code, number })
    }
    ctx.twilio.verifyCode = async (number: string, code: string) => {
      if (verificationCodes[number] === code) {
        delete verificationCodes[number]
        return true
      }
      return false
    }

    agent = network.pds.getClient()
  })

  afterAll(async () => {
    await network.close()
  })

  const requestCode = async (phoneNumber: string) => {
    await agent.api.com.atproto.temp.requestPhoneVerification({
      phoneNumber,
    })
    const sent = sentCodes.at(-1)
    assert(sent)
    assert(sent.number === phoneNumber)
    return sent.code
  }

  const createAccountWithCode = async (phoneNumber?: string, code?: string) => {
    const name = crypto.randomStr(5, 'base32')
    const res = await agent.api.com.atproto.server.createAccount({
      email: `${name}@test.com`,
      handle: `${name}.test`,
      password: name,
      verificationPhone: phoneNumber,
      verificationCode: code,
    })
    return {
      ...res.data,
      password: name,
    }
  }

  it('describes the fact that invites are required', async () => {
    const res = await agent.api.com.atproto.server.describeServer({})
    expect(res.data.phoneVerificationRequired).toBe(true)
  })

  const aliceNumber = '+11234567890'
  let aliceCode: string
  let aliceDid: string

  it('requests a phone verification code', async () => {
    aliceCode = await requestCode(aliceNumber)
  })

  it('resends a phone verification code', async () => {
    const resent = await requestCode(aliceNumber)
    expect(resent).toEqual(aliceCode)
  })

  it('allows signup using a valid phone verification code', async () => {
    const res = await createAccountWithCode(aliceNumber, aliceCode)
    aliceDid = res.did
  })

  it('stores the associated phone number of an account', async () => {
    const res = await ctx.db.db
      .selectFrom('phone_verification')
      .selectAll()
      .where('did', '=', aliceDid)
      .execute()
    expect(res.length).toBe(1)
    expect(res[0].phoneNumber).toBe(aliceNumber)
  })

  it('does not allow signup with an already used code', async () => {
    const attempt = createAccountWithCode(aliceNumber, aliceCode)
    await expect(attempt).rejects.toThrow(
      'Could not verify phone number. Please try again.',
    )
  })

  it('does not allow signup with out a code', async () => {
    const attempt = createAccountWithCode()
    await expect(attempt).rejects.toThrow(
      'Phone number verification is required on this server and none was provided.',
    )
  })

  it('does not allow signup when missing a code or a phone number', async () => {
    const bobNumber = '+1098765432'
    const bobCode = await requestCode(bobNumber)
    const attempt = createAccountWithCode(undefined, bobCode)
    await expect(attempt).rejects.toThrow(
      'Phone number verification is required on this server and none was provided.',
    )
    const attempt2 = createAccountWithCode(bobNumber, undefined)
    await expect(attempt2).rejects.toThrow(
      'Phone number verification is required on this server and none was provided.',
    )
  })

  it('does not allow signup with a valid code and a mismatched phone number', async () => {
    const carolCode = await requestCode('+11111111111')
    const attempt = createAccountWithCode('+12222222222', carolCode)
    await expect(attempt).rejects.toThrow(
      'Could not verify phone number. Please try again.',
    )
  })

  it('does not allow more than the configured number of signups from the same code', async () => {
    const danNumber = '+3333333333'
    for (let i = 0; i < 3; i++) {
      const danCode = await requestCode(danNumber)
      await createAccountWithCode(danNumber, danCode)
    }
    const attempt = requestCode(danNumber)
    await expect(attempt).rejects.toThrow(
      `There are too many accounts currently using this phone number. Max: 3`,
    )
  })
})
