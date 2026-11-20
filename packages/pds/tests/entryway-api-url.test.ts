import { once } from 'node:events'
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import {
  type ServerEnvironment,
  envToCfg,
  readEnv,
} from '../src/config/index.js'
import { com } from '../src/lexicons/index.js'

const ENTRYWAY_URL = 'https://entryway.invalid'

type RecordedRequest = {
  method?: string
  url?: string
  authorization?: string
}

describe('entryway api url', () => {
  describe('config', () => {
    const baseEnv: ServerEnvironment = {
      blobstoreDiskLocation: '/tmp/blobs',
      entrywayUrl: ENTRYWAY_URL,
      entrywayDid: 'did:example:entryway',
      entrywayJwtVerifyKeyK256PublicKeyHex: 'abcd',
      entrywayPlcRotationKey: 'did:key:example',
    }

    it('defaults to the entryway url.', () => {
      const cfg = envToCfg(baseEnv)
      expect(cfg.entryway?.url).toBe(ENTRYWAY_URL)
      expect(cfg.entryway?.apiUrl).toBe(ENTRYWAY_URL)
    })

    it('leaves the entryway url public when set.', () => {
      const cfg = envToCfg({
        ...baseEnv,
        entrywayApiUrl: 'http://127.0.0.1:8443',
      })
      expect(cfg.entryway?.apiUrl).toBe('http://127.0.0.1:8443')
      expect(cfg.entryway?.url).toBe(ENTRYWAY_URL)
      expect(cfg.oauth.issuer).toBe(ENTRYWAY_URL)
    })

    it('is read from PDS_ENTRYWAY_API_URL.', () => {
      const prev = process.env.PDS_ENTRYWAY_API_URL
      try {
        process.env.PDS_ENTRYWAY_API_URL = 'http://127.0.0.1:8443'
        expect(readEnv().entrywayApiUrl).toBe('http://127.0.0.1:8443')
        process.env.PDS_ENTRYWAY_API_URL = ''
        expect(readEnv().entrywayApiUrl).toBeUndefined()
      } finally {
        if (prev === undefined) delete process.env.PDS_ENTRYWAY_API_URL
        else process.env.PDS_ENTRYWAY_API_URL = prev
      }
    })
  })

  describe('clients', () => {
    let plc: TestPlc
    let pds: TestPds
    let apiServer: http.Server
    let apiUrl: string
    const received: RecordedRequest[] = []

    beforeAll(async () => {
      // Stands in for a local proxy in front of the entryway: answers every
      // call with an empty success, which suits procedures without output.
      apiServer = http.createServer((req, res) => {
        received.push({
          method: req.method,
          url: req.url,
          authorization: req.headers.authorization,
        })
        req.resume()
        req.on('end', () => res.writeHead(200).end())
      })
      apiServer.listen(0, '127.0.0.1')
      await once(apiServer, 'listening')
      const { port } = apiServer.address() as AddressInfo
      apiUrl = `http://127.0.0.1:${port}`

      const jwtSigningKey = await Secp256k1Keypair.create()
      const plcRotationKey = await Secp256k1Keypair.create()
      plc = await TestPlc.create({})
      pds = await TestPds.create({
        entrywayUrl: ENTRYWAY_URL,
        entrywayApiUrl: apiUrl,
        entrywayDid: 'did:example:entryway',
        entrywayJwtVerifyKeyK256PublicKeyHex: jwtSigningKey.publicKeyStr('hex'),
        entrywayPlcRotationKey: plcRotationKey.did(),
        bskyAppViewUrl: undefined,
        bskyAppViewDid: undefined,
        didPlcUrl: plc.url,
        serviceDid: 'did:example:pds',
      })
    })

    afterAll(async () => {
      await pds?.close()
      await plc?.close()
      apiServer?.closeAllConnections()
      await new Promise((resolve) => apiServer?.close(resolve))
    })

    beforeEach(() => {
      received.length = 0
    })

    it('call the entryway at the api url.', async () => {
      await pds
        .getAgent()
        .com.atproto.server.requestPasswordReset(
          { email: 'nobody@example.com' },
          { encoding: 'application/json' },
        )
      expect(received).toEqual([
        {
          method: 'POST',
          url: '/xrpc/com.atproto.server.requestPasswordReset',
          authorization: undefined,
        },
      ])
    })

    it('call the entryway as admin at the api url.', async () => {
      const { entrywayAdminClient } = pds.ctx
      expect(entrywayAdminClient).toBeDefined()
      await entrywayAdminClient!.xrpc(com.atproto.admin.updateAccountEmail, {
        body: { account: 'did:example:alice', email: 'alice@example.com' },
      })
      expect(received).toEqual([
        {
          method: 'POST',
          url: '/xrpc/com.atproto.admin.updateAccountEmail',
          authorization: expect.stringMatching(/^Basic /),
        },
      ])
    })

    it('advertise the public url as the authorization server.', async () => {
      const res = await fetch(
        new URL('/.well-known/oauth-protected-resource', pds.url),
      )
      const metadata = await res.json()
      expect(metadata.authorization_servers).toEqual([ENTRYWAY_URL])
      expect(received).toEqual([])
    })

    it('redirect password changes to the public url.', async () => {
      const res = await fetch(
        new URL('/.well-known/change-password', pds.url),
        {
          redirect: 'manual',
        },
      )
      expect(res.headers.get('location')).toBe(
        `${ENTRYWAY_URL}/.well-known/change-password`,
      )
      expect(received).toEqual([])
    })
  })
})
