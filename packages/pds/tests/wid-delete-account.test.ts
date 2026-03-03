/**
 * Integration test: WID-based account deletion
 *
 * Tests the full flow of io.trustanchor.requestAccountDeleteWID →
 * QuickLogin approval → io.trustanchor.quicklogin.status (with approvalToken) →
 * io.trustanchor.deleteAccountWID.
 *
 * Runs with an in-process mock Neuro/QuickLogin server.
 * Does NOT use @atproto/dev-env (requires bsky/ozone). Instead, starts the PDS
 * directly from source, the same way TestPds.create does.
 * No postgres/redis required — uses SQLite via pnpm test:sqlite.
 */

import { once } from 'node:events'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import express from 'express'
import getPort from 'get-port'
import { Secp256k1Keypair, randomStr } from '@atproto/crypto'
import { PDS, createSecretKeyObject, envToCfg, envToSecrets } from '../src'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MockSession {
  serviceId: string
  callbackUrl: string
  signKey: string | null
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('WID account deletion', () => {
  let pds: PDS
  let pdsUrl: string
  let mockServer: http.Server
  let mockPort: number
  let mockUrl: string

  // Keyed by tempSessionId (the UUID the PDS passes as `sessionId` to /QuickLogin)
  const mockSessions = new Map<string, MockSession>()

  let testDid: string
  let testPassword: string
  let testHandleFull: string // e.g. "wid-deltest.test"

  // ---------------------------------------------------------------------------
  // Setup: mock server + PDS + test account
  // ---------------------------------------------------------------------------

  beforeAll(async () => {
    // 1. Start minimal mock QuickLogin server
    mockPort = await getPort()
    mockUrl = `http://localhost:${mockPort}`

    const app = express()
    app.use(express.json())

    app.post('/QuickLogin', (req: express.Request, res: express.Response) => {
      // Second call: QR image request
      if (req.body.mode === 'image') {
        const { serviceId: incomingServiceId } = req.body as {
          serviceId: string
        }
        if (!incomingServiceId) {
          return void res.status(400).json({ error: 'Missing serviceId' })
        }
        const signKey = `${incomingServiceId}-signkey`
        // Attach signKey to the matching session so the test can trigger the scan
        for (const session of mockSessions.values()) {
          if (session.serviceId === incomingServiceId) {
            session.signKey = signKey
            break
          }
        }
        return void res.json({
          src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
          signUrl: `tagsign:provider,${signKey}`,
        })
      }

      // First call: session registration
      const {
        service,
        callbackUrl: rawCallback,
        sessionId,
      } = req.body as {
        service?: string
        callbackUrl?: string
        sessionId: string
      }
      const callbackUrl = service || rawCallback || ''
      if (!callbackUrl || !sessionId) {
        return void res
          .status(400)
          .json({ error: 'Missing service/callbackUrl or sessionId' })
      }
      const serviceId = `mock-svc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      mockSessions.set(sessionId, { serviceId, callbackUrl, signKey: null })
      return void res.json({ serviceId })
    })

    const httpServer = app.listen(mockPort)
    await once(httpServer, 'listening')
    mockServer = httpServer

    // 2. Start PDS directly (no dev-env needed) with quicklogin enabled
    const plcRotationKey = await Secp256k1Keypair.create({ exportable: true })
    const plcRotationPriv = Buffer.from(await plcRotationKey.export()).toString(
      'hex',
    )
    const recoveryKey = (await Secp256k1Keypair.create()).did()
    const pdsPort = await getPort()
    pdsUrl = `http://localhost:${pdsPort}`

    const blobstoreLoc = path.join(os.tmpdir(), randomStr(8, 'base32'))
    const dataDirectory = path.join(os.tmpdir(), randomStr(8, 'base32'))
    await fs.mkdir(dataDirectory, { recursive: true })

    const env = {
      devMode: true,
      port: pdsPort,
      dataDirectory,
      blobstoreDiskLocation: blobstoreLoc,
      recoveryDidKey: recoveryKey,
      adminPassword: 'admin-pass-test',
      jwtSecret: 'jwt-secret-test-1234567890abcdef',
      serviceHandleDomains: ['.test'],
      bskyAppViewUrl: 'https://appview.invalid',
      bskyAppViewDid: 'did:example:invalid',
      bskyAppViewCdnUrlPattern: 'http://cdn.appview.com/%s/%s/%s',
      modServiceUrl: 'https://moderator.invalid',
      modServiceDid: 'did:example:invalid',
      plcRotationKeyK256PrivateKeyHex: plcRotationPriv,
      inviteRequired: false,
      disableSsrfProtection: true,
      serviceName: 'Test PDS',
      // QuickLogin enabled, pointing to mock server
      quickloginEnabled: true,
      quickloginApiBaseUrl: mockUrl,
    }
    const cfg = envToCfg(env)
    const secrets = envToSecrets(env)
    pds = await PDS.create(cfg, secrets)
    await pds.start()

    const ctx = pds.ctx

    // 3. Create a test account (no invite required in dev mode)
    testPassword = 'testpassword123'
    testHandleFull = 'wid-deltest.test'
    const email = 'wid-deltest@local.invalid'

    const created = await fetch(
      `${pdsUrl}/xrpc/com.atproto.server.createAccount`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          handle: testHandleFull,
          password: testPassword,
        }),
      },
    )
    expect(created.ok).toBe(true)
    const createdData = (await created.json()) as { did: string }
    testDid = createdData.did

    // 4. Insert neuro_identity_link — makes the account "WID-linked"
    await ctx.accountManager.db.db
      .insertInto('neuro_identity_link')
      .values({
        userJid: 'wid-deltest@legal.lab.tagroot.io',
        testUserJid: null,
        did: testDid,
        isTestUser: 0,
        linkedAt: new Date().toISOString(),
        lastLoginAt: null,
      })
      .execute()
  }, 60_000)

  afterAll(async () => {
    await new Promise<void>((resolve) => mockServer.close(() => resolve()))
    await pds.destroy()
  })

  // ---------------------------------------------------------------------------
  // Helper: get a valid access token
  // ---------------------------------------------------------------------------

  async function getAccessToken(): Promise<string> {
    const res = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testHandleFull,
        password: testPassword,
      }),
    })
    const data = (await res.json()) as { accessJwt: string }
    return data.accessJwt
  }

  // ---------------------------------------------------------------------------
  // Tests
  // ---------------------------------------------------------------------------

  it('requestAccountDeleteWID requires authentication', async () => {
    const res = await fetch(
      `${pdsUrl}/xrpc/io.trustanchor.server.requestAccountDeleteWID`,
      {
        method: 'POST',
      },
    )
    expect(res.status).toBe(401)
  })

  it('requestAccountDeleteWID requires a WID-linked account', async () => {
    // Create a second account without a WID link
    const noWidRes = await fetch(
      `${pdsUrl}/xrpc/com.atproto.server.createAccount`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'no-wid@local.invalid',
          handle: 'no-wid.test',
          password: 'testpassword123',
        }),
      },
    )
    expect(noWidRes.ok).toBe(true)
    const noWidData = (await noWidRes.json()) as { accessJwt: string }

    const res = await fetch(
      `${pdsUrl}/xrpc/io.trustanchor.server.requestAccountDeleteWID`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${noWidData.accessJwt}` },
      },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { message: string }
    expect(body.message).toMatch(/WID identity/i)
  })

  it('completes the full WID account deletion flow', async () => {
    const accessJwt = await getAccessToken()

    // -----------------------------------------------------------------------
    // Step 1: requestAccountDeleteWID
    // -----------------------------------------------------------------------
    const initRes = await fetch(
      `${pdsUrl}/xrpc/io.trustanchor.server.requestAccountDeleteWID`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessJwt}` },
      },
    )
    expect(initRes.status).toBe(200)
    const initData = (await initRes.json()) as {
      sessionId: string
      sessionToken: string
      qrCodeUrl: string
      expiresAt: string
    }
    expect(initData.sessionId).toBeTruthy()
    expect(initData.sessionToken).toBeTruthy()
    expect(initData.qrCodeUrl).toMatch(/^data:image\//)
    expect(initData.expiresAt).toBeTruthy()

    // -----------------------------------------------------------------------
    // Step 2: Locate the tempSessionId and signKey in the mock server
    // -----------------------------------------------------------------------
    // Give the PDS a moment to complete the image call (it happens synchronously
    // inside the handler, but the image response populates signKey on the mock session)
    let tempSessionId: string | null = null
    let signKey: string | null = null

    // Wait up to 2 seconds for the image call to arrive
    for (let i = 0; i < 20; i++) {
      for (const [id, sess] of mockSessions) {
        if (sess.signKey) {
          tempSessionId = id
          signKey = sess.signKey
          break
        }
      }
      if (tempSessionId) break
      await new Promise((r) => setTimeout(r, 100))
    }

    expect(tempSessionId).toBeTruthy()
    expect(signKey).toBeTruthy()

    const mockSession = mockSessions.get(tempSessionId!)!

    // -----------------------------------------------------------------------
    // Step 3: Simulate QR scan — POST callback directly to PDS
    // -----------------------------------------------------------------------
    const callbackPayload = {
      SessionId: tempSessionId,
      State: 'Approved',
      JID: 'wid-deltest@lab.tagroot.io',
      Key: signKey,
      Properties: {
        Email: 'wid-deltest@local.invalid',
        Name: 'wid-deltest',
      },
    }

    const callbackRes = await fetch(mockSession.callbackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(callbackPayload),
    })
    expect(callbackRes.ok).toBe(true)

    // -----------------------------------------------------------------------
    // Step 4: Poll status until completed
    // -----------------------------------------------------------------------
    let statusData: {
      status: string
      approvalToken?: string
      error?: string
    } = { status: 'pending' }

    for (let i = 0; i < 20; i++) {
      const statusRes = await fetch(
        `${pdsUrl}/xrpc/io.trustanchor.quicklogin.status`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: initData.sessionId,
            sessionToken: initData.sessionToken,
          }),
        },
      )
      statusData = (await statusRes.json()) as typeof statusData
      if (statusData.status !== 'pending') break
      await new Promise((r) => setTimeout(r, 100))
    }

    expect(statusData.status).toBe('completed')
    expect(statusData.approvalToken).toBeTruthy()
    const approvalToken = statusData.approvalToken!

    // -----------------------------------------------------------------------
    // Step 5: deleteAccountWID
    // -----------------------------------------------------------------------
    const deleteRes = await fetch(
      `${pdsUrl}/xrpc/io.trustanchor.server.deleteAccountWID`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did: testDid, token: approvalToken }),
      },
    )
    expect(deleteRes.status).toBe(200)

    // -----------------------------------------------------------------------
    // Step 6: Verify account is gone — old access token now rejected (400/401)
    // -----------------------------------------------------------------------
    const sessionRes = await fetch(
      `${pdsUrl}/xrpc/com.atproto.server.getSession`,
      { headers: { Authorization: `Bearer ${accessJwt}` } },
    )
    // After deletion the account/session record is gone — server returns
    // 401 (auth required) or 400 (invalid token), both mean the account
    // is no longer accessible.
    expect(sessionRes.status).toBeGreaterThanOrEqual(400)
  }, 30_000)

  it('rejects reuse of approval token (or invalid token)', async () => {
    // testDid is already deleted, so the account-not-found path should trigger
    const res = await fetch(
      `${pdsUrl}/xrpc/io.trustanchor.server.deleteAccountWID`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ did: testDid, token: 'aaaaa-bbbbb' }),
      },
    )
    expect(res.status).toBe(400)
  })
})
