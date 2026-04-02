import assert from 'node:assert'
import { createPrivateKey } from 'node:crypto'
import * as http from 'node:http'
import * as plcLib from '@did-plc/lib'
import { HttpTerminator, createHttpTerminator } from 'http-terminator'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'
import * as ui8 from 'uint8arrays'
import { AtpAgent } from '@atproto/api'
import { getVerificationMaterial } from '@atproto/common'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { IdResolver, getDidKeyFromMultibase } from '@atproto/identity'
import { DidString, HandleString } from '@atproto/syntax'
import {
  AuthRequiredError,
  createServer,
  parseReqNsid,
  verifyJwt as verifyServiceJwt,
} from '@atproto/xrpc-server'
import { bearerTokenFromReq, createPublicKeyObject } from '../src/auth-verifier'
import { com } from '../src/lexicons/index.js'

interface Account {
  did: string
  handle: string
  email?: string
}

interface MockEntrywayOpts {
  port: number
  serviceDid: string
  plcUrl: string
  pdsUrl: string
  pdsDid: string
  adminPassword: string
  jwtSigningKey: Secp256k1Keypair
  plcRotationKey: Secp256k1Keypair
}

type AccessAuthResult = { credentials: { did: string; type: 'access' } }
type ServiceAuthResult = { credentials: { did: string; type: 'service' } }

export class MockEntryway {
  public url: string
  public serviceDid: string
  public plcRotationKey: Secp256k1Keypair
  public idResolver: IdResolver

  private server: http.Server
  private terminator: HttpTerminator
  private accounts = new Map<string, Account>()

  private constructor(
    server: http.Server,
    terminator: HttpTerminator,
    idResolver: IdResolver,
    opts: MockEntrywayOpts,
  ) {
    this.server = server
    this.terminator = terminator
    this.url = `http://localhost:${opts.port}`
    this.serviceDid = opts.serviceDid
    this.plcRotationKey = opts.plcRotationKey
    this.idResolver = idResolver
  }

  static async create(opts: MockEntrywayOpts): Promise<MockEntryway> {
    const keyEncoder = new KeyEncoder('secp256k1')
    const privateKeyHex = ui8.toString(await opts.jwtSigningKey.export(), 'hex')
    const privatePem = keyEncoder.encodePrivate(privateKeyHex, 'raw', 'pem')
    const jwtPrivateKey = createPrivateKey({ format: 'pem', key: privatePem })
    const jwtPublicKey = createPublicKeyObject(
      opts.jwtSigningKey.publicKeyStr('hex'),
    )

    const plcClient = new plcLib.Client(opts.plcUrl)
    const pdsAgent = new AtpAgent({ service: opts.pdsUrl })
    const idResolver = new IdResolver({ plcUrl: opts.plcUrl })

    const accounts = new Map<string, Account>()

    const getSigningKey = async (
      iss: string,
      forceRefresh: boolean,
    ): Promise<string> => {
      const [did, serviceId] = iss.split('#')
      assert(!serviceId, 'no service id expected in iss claim')
      const didDoc = await idResolver.did.resolve(did, forceRefresh)
      if (!didDoc) {
        throw new AuthRequiredError(`could not resolve did: ${did}`)
      }
      const parsedKey = getVerificationMaterial(didDoc, 'atproto')
      if (!parsedKey) {
        throw new AuthRequiredError('missing or bad key in did doc')
      }
      const didKey = getDidKeyFromMultibase(parsedKey)
      if (!didKey) {
        throw new AuthRequiredError('missing or bad key in did doc')
      }
      return didKey
    }

    const bearerToken = (req: http.IncomingMessage): string => {
      const token = bearerTokenFromReq(req)
      if (!token) {
        throw new AuthRequiredError('missing bearer token')
      }
      return token
    }

    // Auth: verify user access token (typ: 'at+jwt') signed by entryway
    const accessAuth = async ({
      req,
    }: {
      req: http.IncomingMessage
    }): Promise<AccessAuthResult> => {
      try {
        const token = bearerToken(req)
        const { payload } = await jose.jwtVerify(token, jwtPublicKey)
        if (!payload.sub) {
          throw new AuthRequiredError('missing sub in token')
        }
        return { credentials: { did: payload.sub, type: 'access' } }
      } catch (err) {
        console.log(err)
        throw err
      }
    }

    // Auth: verify service auth token from PDS (no typ / typ !== 'at+jwt')
    const serviceAuth = async ({
      req,
    }: {
      req: http.IncomingMessage
    }): Promise<ServiceAuthResult> => {
      try {
        const token = bearerToken(req)
        const nsid = parseReqNsid(req)
        const payload = await verifyServiceJwt(
          token,
          opts.serviceDid,
          nsid,
          getSigningKey,
        )
        return { credentials: { did: payload.iss, type: 'service' } }
      } catch (err) {
        console.log(err)
        throw err
      }
    }

    // Auth: accept either access token or service auth
    const accessOrServiceAuth = async ({
      req,
    }: {
      req: http.IncomingMessage
    }): Promise<AccessAuthResult | ServiceAuthResult> => {
      const token = bearerToken(req)
      const { typ } = jose.decodeProtectedHeader(token)
      if (typ === 'at+jwt') {
        return accessAuth({ req })
      }
      return serviceAuth({ req })
    }

    const server = createServer()

    server.add(com.atproto.server.createAccount, {
      handler: async ({ input }) => {
        const { email, handle } = input.body

        // Reserve a signing key on the PDS
        const {
          data: { signingKey },
        } = await pdsAgent.com.atproto.server.reserveSigningKey({})

        // Create PLC operation
        const plcCreate = await plcLib.createOp({
          signingKey,
          rotationKeys: [opts.plcRotationKey.did()],
          handle,
          pds: opts.pdsUrl,
          signer: opts.plcRotationKey,
        })

        // Create account on PDS (no auth needed — userServiceAuthOptional)
        await pdsAgent.com.atproto.server.createAccount({
          did: plcCreate.did,
          handle,
          plcOp: plcCreate.op,
        })

        // Store account in memory
        accounts.set(plcCreate.did, {
          did: plcCreate.did,
          handle,
          email,
        })

        // Sign access + refresh JWTs
        const now = Math.floor(Date.now() / 1000)
        const accessJwt = await new jose.SignJWT({
          scope: 'com.atproto.access',
        })
          .setProtectedHeader({ alg: 'ES256K', typ: 'at+jwt' })
          .setSubject(plcCreate.did)
          .setAudience(opts.pdsDid)
          .setIssuedAt(now)
          .setExpirationTime(now + 60 * 60)
          .setJti(randomStr(16, 'base32'))
          .sign(jwtPrivateKey)

        const refreshJwt = await new jose.SignJWT({
          scope: 'com.atproto.refresh',
        })
          .setProtectedHeader({ alg: 'ES256K', typ: 'at+jwt' })
          .setSubject(plcCreate.did)
          .setAudience(opts.pdsDid)
          .setIssuedAt(now)
          .setExpirationTime(now + 90 * 24 * 60 * 60)
          .setJti(randomStr(16, 'base32'))
          .sign(jwtPrivateKey)

        return {
          encoding: 'application/json' as const,
          body: {
            did: plcCreate.did as DidString,
            handle,
            accessJwt,
            refreshJwt,
          },
        }
      },
    })

    server.add(com.atproto.server.getSession, {
      auth: accessOrServiceAuth,
      handler: async ({ auth }) => {
        const account = accounts.get(auth.credentials.did)
        if (!account) {
          throw new Error(
            `Could not find account for DID: ${auth.credentials.did}`,
          )
        }
        return {
          encoding: 'application/json' as const,
          body: {
            did: account.did as DidString,
            handle: account.handle as HandleString,
            email: account.email,
            emailConfirmed: false,
          },
        }
      },
    })

    server.add(com.atproto.identity.updateHandle, {
      auth: serviceAuth,
      handler: async ({ auth, input }) => {
        // The PDS sends { did, handle } where did is the target user
        const body = input.body as { did?: string; handle: string }
        const targetDid = body.did || auth.credentials.did
        const newHandle = body.handle

        // Update handle in PLC
        await plcClient.updateHandle(targetDid, opts.plcRotationKey, newHandle)

        // Update in-memory account
        const account = accounts.get(targetDid)
        if (account) {
          account.handle = newHandle
        }

        // Notify PDS via admin endpoint
        const adminAuth = Buffer.from(`admin:${opts.adminPassword}`).toString(
          'base64',
        )
        await pdsAgent.com.atproto.admin.updateAccountHandle(
          { did: targetDid, handle: newHandle },
          {
            headers: { authorization: `Basic ${adminAuth}` },
            encoding: 'application/json',
          },
        )
      },
    })

    const httpServer = server.listen(opts.port)
    const terminator = createHttpTerminator({ server: httpServer })

    const instance = new MockEntryway(httpServer, terminator, idResolver, opts)
    instance.accounts = accounts

    return instance
  }

  getAccount(did: string): Account | undefined {
    return this.accounts.get(did)
  }

  async destroy(): Promise<void> {
    await this.terminator.terminate()
  }
}
