import assert from 'assert'
import { createSecretKey } from 'crypto'
import AtpAgent from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { SignJWT, EncryptJWT } from 'jose'
import { AppContext } from '../src'
import { AuthScope } from '../src/auth-verifier'

describe('phone verification', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent

  let verificationCodes: Record<string, string>
  let sentCodes: { number: string; code: string }[]
  const jwtSecret = 'ZQMU01bs0IY'
  const jweSecret128BitHex = '58ef18256d3f7280f4aa1ac478851c43'

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'phone_verification',
      pds: {
        jwtSecret,
        jweSecret128BitHex,
        phoneVerificationRequired: true,
        phoneVerificationProvider: 'twilio',
        twilioAccountSid: 'ACXXXXXXX',
        twilioAuthToken: 'AUTH',
        twilioServiceSid: 'VAXXXXXXXX',
        bypassPhoneNumber: '+10000000000',
      },
    })
    ctx = network.pds.ctx
    assert(ctx.phoneVerifier)
    verificationCodes = {}
    sentCodes = []
    ctx.phoneVerifier.sendCode = async (number: string) => {
      if (!verificationCodes[number]) {
        const code = crypto.randomStr(4, 'base10').slice(0, 6)
        verificationCodes[number] = code
      }
      const code = verificationCodes[number]
      sentCodes.push({ code, number })
    }
    ctx.phoneVerifier.verifyCode = async (number: string, code: string) => {
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

  const createAccountWithCode = async (
    phoneNumber?: string,
    code?: string,
    name?: string,
  ) => {
    name ??= crypto.randomStr(5, 'base32')
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
      `Verification is now required on this server. Please make sure you're using the latest version of the Bluesky app.`,
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
      `Verification is now required on this server. Please make sure you're using the latest version of the Bluesky app.`,
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

  it('bypasses phone number verification', async () => {
    await requestCode('+10000000000')
    await createAccountWithCode('+10000000000')
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

  describe('self-verification', () => {
    const jwtKey = createSecretKey(Buffer.from(jwtSecret))
    const jwtHeader = { alg: 'HS256' }
    const jweKey = createSecretKey(Buffer.from(jweSecret128BitHex, 'hex'))
    const jweHeader = { enc: 'A128CBC-HS256', alg: 'A128KW' }
    const getNonce = () => crypto.randomStr(10, 'base16')
    it('succeeds when code is correct', async () => {
      const token = await new EncryptJWT({
        scope: AuthScope.CreateAccount,
        handle: 'self1.test',
        verdict: 'yea',
      })
        .setJti(getNonce())
        .setAudience(ctx.cfg.service.did)
        .setProtectedHeader(jweHeader)
        .setIssuedAt()
        .setExpirationTime('1hr')
        .encrypt(jweKey)
      await expect(
        createAccountWithCode(undefined, token, 'self1'),
      ).resolves.toBeDefined()
    })

    it('fails when code has bad scope', async () => {
      const token = await new EncryptJWT({
        scope: AuthScope.Access,
        handle: 'self2.test',
        verdict: 'yea',
      })
        .setJti(getNonce())
        .setAudience(ctx.cfg.service.did)
        .setProtectedHeader(jweHeader)
        .setIssuedAt()
        .setExpirationTime('1hr')
        .encrypt(jweKey)
      await expect(
        createAccountWithCode(undefined, token, 'self2'),
      ).rejects.toThrow('Invalid verification code.')
    })

    it('fails when code has bad verdict', async () => {
      const token = await new EncryptJWT({
        scope: AuthScope.CreateAccount,
        handle: 'self3.test',
        verdict: 'nay',
      })
        .setJti(getNonce())
        .setAudience(ctx.cfg.service.did)
        .setProtectedHeader(jweHeader)
        .setIssuedAt()
        .setExpirationTime('1hr')
        .encrypt(jweKey)
      await expect(
        createAccountWithCode(undefined, token, 'self3'),
      ).rejects.toThrow('Invalid verification code.')
    })

    it('fails when code has bad handle match', async () => {
      const token = await new EncryptJWT({
        scope: AuthScope.CreateAccount,
        handle: 'selfX.test',
        verdict: 'yea',
      })
        .setJti(getNonce())
        .setAudience(ctx.cfg.service.did)
        .setProtectedHeader(jweHeader)
        .setIssuedAt()
        .setExpirationTime('1hr')
        .encrypt(jweKey)
      await expect(
        createAccountWithCode(undefined, token, 'self4'),
      ).rejects.toThrow('Invalid verification code.')
    })

    it('fails when code is expired', async () => {
      const token = await new EncryptJWT({
        scope: AuthScope.CreateAccount,
        handle: 'self5.test',
        verdict: 'yea',
      })
        .setJti(getNonce())
        .setAudience(ctx.cfg.service.did)
        .setProtectedHeader(jweHeader)
        .setIssuedAt()
        .setExpirationTime(0)
        .encrypt(jweKey)
      await expect(
        createAccountWithCode(undefined, token, 'self5'),
      ).rejects.toThrow('Token has expired')
    })

    it('fails when code had bad audience', async () => {
      const token = await new EncryptJWT({
        scope: AuthScope.CreateAccount,
        handle: 'self6.test',
        verdict: 'yea',
      })
        .setJti(getNonce())
        .setAudience('did:example:oops')
        .setProtectedHeader(jweHeader)
        .setIssuedAt()
        .setExpirationTime('1hr')
        .encrypt(jweKey)
      await expect(
        createAccountWithCode(undefined, token, 'self6'),
      ).rejects.toThrow('Token could not be verified')
    })

    it('fails when code is malformed', async () => {
      await expect(
        createAccountWithCode(undefined, 'not.a.jwtorjwe', 'self7'),
      ).rejects.toThrow('Token could not be verified')
    })

    it('succeeds when jwt code is correct', async () => {
      const token = await new SignJWT({
        scope: AuthScope.CreateAccount,
        handle: 'self7.test',
        verdict: 'yea',
      })
        .setJti(getNonce())
        .setAudience(ctx.cfg.service.did)
        .setProtectedHeader(jwtHeader)
        .setIssuedAt()
        .setExpirationTime('1hr')
        .sign(jwtKey)
      await expect(
        createAccountWithCode(undefined, token, 'self7'),
      ).resolves.toBeDefined()
    })

    it('fails when jwt code has bad verdict', async () => {
      const token = await new SignJWT({
        scope: AuthScope.CreateAccount,
        handle: 'self8.test',
        verdict: 'bad', // @NOTE using deprecated bad verdict value
      })
        .setJti(getNonce())
        .setAudience(ctx.cfg.service.did)
        .setProtectedHeader(jwtHeader)
        .setIssuedAt()
        .setExpirationTime('1hr')
        .sign(jwtKey)
      await expect(
        createAccountWithCode(undefined, token, 'self8'),
      ).rejects.toThrow('Invalid verification code.')
    })
  })
})
