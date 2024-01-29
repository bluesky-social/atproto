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
      `Text verification is now required on this server. Please make sure you're using the latest version of the Bluesky app.`,
    )
  })

  it('does not allow signup when missing a code or a phone number', async () => {
    const bobNumber = '+1098765432'
    const bobCode = await requestCode(bobNumber)
    const attempt = createAccountWithCode(undefined, bobCode)
    await expect(attempt).rejects.toThrow(
      `Text verification is now required on this server. Please make sure you're using the latest version of the Bluesky app.`,
    )
    const attempt2 = createAccountWithCode(bobNumber, undefined)
    await expect(attempt2).rejects.toThrow(
      `Text verification is now required on this server. Please make sure you're using the latest version of the Bluesky app.`,
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
    const danNumber = '+13333333333'
    for (let i = 0; i < 3; i++) {
      const danCode = await requestCode(danNumber)
      await createAccountWithCode(danNumber, danCode)
    }
    const attempt = requestCode(danNumber)
    await expect(attempt).rejects.toThrow(
      `There are too many accounts currently using this phone number. Max: 3`,
    )
  })

  it('normalizes phone numbers', async () => {
    const code1 = await requestCode('+1 (444)444-4444')
    expect(verificationCodes['+14444444444']).toEqual(code1)
    const code2 = await requestCode('(555)555-5555')
    expect(verificationCodes['+15555555555']).toEqual(code2)
    const code3 = await requestCode('1(666)666-6666')
    expect(verificationCodes['+16666666666']).toEqual(code3)
    const attempt1 = requestCode('+1444444444444444')
    await expect(attempt1).rejects.toThrow('Invalid phone number')
    const attempt2 = requestCode('a44444444')
    await expect(attempt2).rejects.toThrow('Invalid phone number')
  })
})
