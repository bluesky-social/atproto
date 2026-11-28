import { once } from 'node:events'
import * as http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { Secp256k1Keypair } from '@atproto/crypto'
import { TestPds, TestPlc } from '@atproto/dev-env'
import { com } from '../src/lexicons/index.js'

const ENTRYWAY_URL = 'https://entryway.invalid'

type RecordedRequest = {
  method?: string
  url?: string
  authorization?: string
}

describe('entryway api url', () => {
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
      if (apiServer) {
        apiServer.closeAllConnections()
        await new Promise<void>((resolve, reject) =>
          apiServer.close((err) => (err ? reject(err) : resolve())),
        )
      }
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
