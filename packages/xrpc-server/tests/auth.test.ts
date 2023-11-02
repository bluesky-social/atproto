import * as http from 'node:http'
import { KeyObject, createPrivateKey } from 'node:crypto'
import getPort from 'get-port'
import * as jose from 'jose'
import KeyEncoder from 'key-encoder'
import * as ui8 from 'uint8arrays'
import { MINUTE } from '@atproto/common'
import { Secp256k1Keypair } from '@atproto/crypto'
import { LexiconDoc } from '@atproto/lexicon'
import xrpc, { ServiceClient, XRPCError } from '@atproto/xrpc'
import * as xrpcServer from '../src'
import {
  createServer,
  closeServer,
  createBasicAuth,
  basicAuthHeaders,
} from './_util'

const LEXICONS: LexiconDoc[] = [
  {
    lexicon: 1,
    id: 'io.example.authTest',
    defs: {
      main: {
        type: 'procedure',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              present: { type: 'boolean', const: true },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            properties: {
              username: { type: 'string' },
              original: { type: 'string' },
            },
          },
        },
      },
    },
  },
]

describe('Auth', () => {
  let s: http.Server
  const server = xrpcServer.createServer(LEXICONS)
  server.method('io.example.authTest', {
    auth: createBasicAuth({ username: 'admin', password: 'password' }),
    handler: ({ auth }) => {
      return {
        encoding: 'application/json',
        body: {
          username: auth?.credentials?.username,
          original: auth?.artifacts?.original,
        },
      }
    },
  })
  xrpc.addLexicons(LEXICONS)

  let client: ServiceClient
  beforeAll(async () => {
    const port = await getPort()
    s = await createServer(port, server)
    client = xrpc.service(`http://localhost:${port}`)
  })
  afterAll(async () => {
    await closeServer(s)
  })

  it('fails on bad auth before invalid request payload.', async () => {
    try {
      await client.call(
        'io.example.authTest',
        {},
        { present: false },
        {
          headers: basicAuthHeaders({
            username: 'admin',
            password: 'wrong',
          }),
        },
      )
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(XRPCError)
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('AuthenticationRequired')
      expect(e.message).toBe('Authentication Required')
      expect(e.status).toBe(401)
    }
  })

  it('fails on invalid request payload after good auth.', async () => {
    try {
      await client.call(
        'io.example.authTest',
        {},
        { present: false },
        {
          headers: basicAuthHeaders({
            username: 'admin',
            password: 'password',
          }),
        },
      )
      throw new Error('Didnt throw')
    } catch (e: any) {
      expect(e).toBeInstanceOf(XRPCError)
      expect(e.success).toBeFalsy()
      expect(e.error).toBe('InvalidRequest')
      expect(e.message).toBe('Input/present must be true')
      expect(e.status).toBe(400)
    }
  })

  it('succeeds on good auth and payload.', async () => {
    const res = await client.call(
      'io.example.authTest',
      {},
      { present: true },
      {
        headers: basicAuthHeaders({
          username: 'admin',
          password: 'password',
        }),
      },
    )
    expect(res.success).toBe(true)
    expect(res.data).toEqual({
      username: 'admin',
      original: 'YWRtaW46cGFzc3dvcmQ=',
    })
  })

  describe('verifyJwt()', () => {
    it('fails on expired jwt.', async () => {
      const keypair = await Secp256k1Keypair.create()
      const jwt = await xrpcServer.createServiceJwt({
        aud: 'did:example:aud',
        iss: 'did:example:iss',
        keypair,
        exp: Math.floor((Date.now() - MINUTE) / 1000),
      })
      const tryVerify = xrpcServer.verifyJwt(
        jwt,
        'did:example:aud',
        async () => {
          return keypair.did()
        },
      )
      await expect(tryVerify).rejects.toThrow('jwt expired')
    })

    it('fails on bad audience.', async () => {
      const keypair = await Secp256k1Keypair.create()
      const jwt = await xrpcServer.createServiceJwt({
        aud: 'did:example:aud1',
        iss: 'did:example:iss',
        keypair,
      })
      const tryVerify = xrpcServer.verifyJwt(
        jwt,
        'did:example:aud2',
        async () => {
          return keypair.did()
        },
      )
      await expect(tryVerify).rejects.toThrow(
        'jwt audience does not match service did',
      )
    })

    it('refreshes key on verification failure.', async () => {
      const keypair1 = await Secp256k1Keypair.create()
      const keypair2 = await Secp256k1Keypair.create()
      const jwt = await xrpcServer.createServiceJwt({
        aud: 'did:example:aud',
        iss: 'did:example:iss',
        keypair: keypair2,
      })
      let usedKeypair1 = false
      let usedKeypair2 = false
      const tryVerify = xrpcServer.verifyJwt(
        jwt,
        'did:example:aud',
        async (_did, forceRefresh) => {
          if (forceRefresh) {
            usedKeypair2 = true
            return keypair2.did()
          } else {
            usedKeypair1 = true
            return keypair1.did()
          }
        },
      )
      await expect(tryVerify).resolves.toMatchObject({
        aud: 'did:example:aud',
        iss: 'did:example:iss',
      })
      expect(usedKeypair1).toBe(true)
      expect(usedKeypair2).toBe(true)
    })

    it('interoperates with jwts signed by other libraries.', async () => {
      const keypair = await Secp256k1Keypair.create({ exportable: true })
      const signingKey = await createPrivateKeyObject(keypair)
      const payload = {
        aud: 'did:example:aud',
        iss: 'did:example:iss',
        exp: Math.floor((Date.now() + MINUTE) / 1000),
      }
      const jwt = await new jose.SignJWT(payload)
        .setProtectedHeader({ typ: 'JWT', alg: keypair.jwtAlg })
        .sign(signingKey)
      const tryVerify = xrpcServer.verifyJwt(
        jwt,
        'did:example:aud',
        async () => {
          return keypair.did()
        },
      )
      await expect(tryVerify).resolves.toEqual(payload)
    })
  })
})

const createPrivateKeyObject = async (
  privateKey: Secp256k1Keypair,
): Promise<KeyObject> => {
  const raw = await privateKey.export()
  const encoder = new KeyEncoder('secp256k1')
  const key = encoder.encodePrivate(ui8.toString(raw, 'hex'), 'raw', 'pem')
  return createPrivateKey({ format: 'pem', key })
}
