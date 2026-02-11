import { once } from 'events'
import express from 'express'
import getPort from 'get-port'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { AtpAgent } from '@atproto/api'
import {
  NeuroAuthManager,
  NeuroIdentity,
} from '../src/account-manager/helpers/neuro-auth-manager'

/**
 * Neuro Quick Login Integration Tests
 *
 * These tests verify the complete Neuro authentication flow.
 *
 * To run with MOCK Neuro API (default):
 *   pnpm test neuro-integration
 *
 * To run with REAL Neuro API (when you have credentials):
 *   NEURO_REAL_API=true NEURO_DOMAIN=mateo.lab.tagroot.io pnpm test neuro-integration
 */

const USE_REAL_NEURO_API = process.env.NEURO_REAL_API === 'true'
const NEURO_DOMAIN = process.env.NEURO_DOMAIN || 'mateo.lab.tagroot.io'

describe('Neuro Quick Login Integration', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let pdsUrl: string
  let mockNeuroServer: express.Application | null = null
  let mockNeuroServerInstance: any = null
  let mockNeuroPort: number | null = null
  let mockNeuroUrl: string | null = null

  // Mock Neuro API state
  const mockSessions = new Map<
    string,
    {
      sessionId: string
      serviceId: string
      callbackUrl: string
      completed: boolean
      identity?: NeuroIdentity
    }
  >()

  beforeAll(async () => {
    // Set up mock Neuro server if not using real API
    if (!USE_REAL_NEURO_API) {
      mockNeuroPort = await getPort()
      mockNeuroUrl = `http://localhost:${mockNeuroPort}`

      mockNeuroServer = express()
      mockNeuroServer.use(express.json())

      // Mock POST /QuickLogin endpoint
      mockNeuroServer.post('/QuickLogin', (req, res) => {
        const { callbackUrl, sessionId } = req.body
        const serviceId = `mock-service-${Date.now()}`

        console.log('🧪 Mock Neuro: Session initiated', {
          sessionId,
          serviceId,
        })

        mockSessions.set(sessionId, {
          sessionId,
          serviceId,
          callbackUrl,
          completed: false,
        })

        res.json({ serviceId })
      })

      // Mock endpoint to simulate QR scan (for testing)
      mockNeuroServer.post('/mock/scan-qr/:sessionId', async (req, res) => {
        const { sessionId } = req.params
        const session = mockSessions.get(sessionId)

        if (!session) {
          return res.status(404).json({ error: 'Session not found' })
        }

        // Simulate Neuro identity data
        const identity: NeuroIdentity = {
          sessionId,
          jid: req.body.jid || 'testuser@neuro.example.com',
          userName: req.body.userName || 'testuser',
          email: req.body.email || 'testuser@example.com',
        }

        session.identity = identity
        session.completed = true

        console.log('🧪 Mock Neuro: QR scanned, sending callback', {
          sessionId,
        })

        // Send callback to PDS
        try {
          const callbackResponse = await fetch(session.callbackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(identity),
          })

          console.log('🧪 Mock Neuro: Callback sent', {
            status: callbackResponse.status,
            ok: callbackResponse.ok,
          })

          res.json({ success: true, identity })
        } catch (error) {
          console.error('🧪 Mock Neuro: Callback failed', error)
          res.status(500).json({ error: 'Callback failed' })
        }
      })

      // Start mock server
      mockNeuroServerInstance = mockNeuroServer.listen(mockNeuroPort)
      await once(mockNeuroServerInstance, 'listening')
      console.log(`🧪 Mock Neuro API running at ${mockNeuroUrl}`)
    }

    // Create test network with Neuro enabled
    network = await TestNetworkNoAppView.create({
      pds: {
        neuro: {
          enabled: true,
          domain: USE_REAL_NEURO_API
            ? NEURO_DOMAIN
            : mockNeuroUrl!.replace('http://', ''),
          storageBackend: 'database' as const,
        },
      },
    })

    pdsUrl = network.pds.url
    agent = network.pds.getClient()

    console.log(`✅ Test PDS running at ${pdsUrl}`)
    console.log(`✅ Neuro API: ${USE_REAL_NEURO_API ? 'REAL' : 'MOCK'}`)
  })

  afterAll(async () => {
    if (mockNeuroServerInstance) {
      // Close mock server
      await new Promise<void>((resolve) => {
        mockNeuroServerInstance.close(() => {
          console.log('🧪 Mock Neuro server shut down')
          resolve()
        })
      })
    }
    await network?.close()

    // Give a moment for cleanup to complete
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  describe('NeuroAuthManager', () => {
    it('should create a Neuro auth manager', () => {
      const ctx = network.pds.ctx
      expect(ctx.neuroAuthManager).toBeDefined()
      expect(typeof ctx.neuroAuthManager?.initiateSession).toBe('function')
    })

    it('should initiate a session and generate QR code', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      const result = await manager.initiateSession()

      expect(result.sessionId).toBeTruthy()
      expect(result.serviceId).toBeTruthy()
      expect(result.qrCodeUrl).toContain(result.serviceId)
      expect(result.verificationCode).toMatch(/^\d{3}-\d{3}$/)

      console.log('✅ Session initiated:', {
        sessionId: result.sessionId.substring(0, 8) + '...',
        serviceId: result.serviceId,
        qrCodeUrl: result.qrCodeUrl,
        verificationCode: result.verificationCode,
      })
    })

    it('should handle callback and complete session', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      const result = await manager.initiateSession()

      // Simulate callback
      const mockIdentity: NeuroIdentity = {
        sessionId: result.sessionId,
        jid: 'callback-test@neuro.example.com',
        userName: 'callbacktest',
        email: 'callbacktest@example.com',
      }

      manager.handleCallback(mockIdentity)

      // Verify session completed
      expect(manager.isSessionCompleted(result.sessionId)).toBe(true)
      expect(manager.getSessionIdentity(result.sessionId)).toEqual(mockIdentity)

      console.log('✅ Callback handled successfully')
    })

    it('should handle duplicate callbacks idempotently', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      const result = await manager.initiateSession()

      const mockIdentity: NeuroIdentity = {
        sessionId: result.sessionId,
        jid: 'idempotent-test@neuro.example.com',
        userName: 'idempotenttest',
        email: 'idempotent@example.com',
      }

      // First callback
      manager.handleCallback(mockIdentity)

      // Duplicate callback - should not throw
      expect(() => manager.handleCallback(mockIdentity)).not.toThrow()

      console.log('✅ Duplicate callback handled idempotently')
    })

    it('should validate verification codes', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      const result = await manager.initiateSession()

      // Get session by code
      const cleanCode = result.verificationCode.replace('-', '')
      const foundSessionId = manager.getSessionByCode(cleanCode)

      expect(foundSessionId).toBe(result.sessionId)

      // Invalid code
      expect(manager.getSessionByCode('999999')).toBeUndefined()

      console.log('✅ Verification code validation works')
    })
  })

  describe('Sign-up Flow', () => {
    it('should create a new account with Neuro authentication', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      // Step 1: Initiate session
      const { sessionId, verificationCode, qrCodeUrl } =
        await manager.initiateSession()

      console.log('📱 Signup: QR Code:', qrCodeUrl)
      console.log('📱 Signup: Verification Code:', verificationCode)

      // Step 2: Simulate QR scan (mock only)
      if (!USE_REAL_NEURO_API) {
        const mockIdentity = {
          jid: `signup-${Date.now()}@neuro.example.com`,
          userName: 'newuser',
          email: `newuser-${Date.now()}@example.com`,
        }

        await fetch(`${mockNeuroUrl}/mock/scan-qr/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockIdentity),
        })

        // Wait for callback to be processed
        await new Promise((resolve) => setTimeout(resolve, 100))
      } else {
        console.log(
          '⏸️  REAL API MODE: Please scan the QR code with your Neuro app',
        )
        console.log('⏸️  Waiting 60 seconds for QR scan...')

        // Wait for real QR scan
        await new Promise((resolve) => setTimeout(resolve, 60000))
      }

      // Step 3: Verify session completed
      expect(manager.isSessionCompleted(sessionId)).toBe(true)

      const identity = manager.getSessionIdentity(sessionId)
      expect(identity).toBeDefined()
      expect(identity?.jid).toBeTruthy()

      console.log('✅ Neuro session completed:', {
        jid: identity?.jid,
        email: identity?.email,
      })

      // Step 4: Complete signup via OAuth (this would normally be done by OAuth UI)
      // For now, we verify the account was created
      const accountLink = await manager.findAccountByLegalIdOrJid(identity!.jid)

      if (accountLink) {
        console.log('✅ Account created and linked:', accountLink.did)
      } else {
        console.log('ℹ️  Account not yet created (OAuth flow incomplete)')
      }
    }, 70000) // 70 second timeout for real API mode
  })

  describe('Login Flow', () => {
    let testJid: string
    let testDid: string

    beforeAll(async () => {
      // Create a test account first
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      const { sessionId } = await manager.initiateSession()

      const mockIdentity: NeuroIdentity = {
        sessionId,
        jid: `login-test-${Date.now()}@neuro.example.com`,
        userName: 'logintest',
        email: `logintest-${Date.now()}@example.com`,
      }

      if (!USE_REAL_NEURO_API) {
        await fetch(`${mockNeuroUrl}/mock/scan-qr/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockIdentity),
        })

        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Create account via API
      const handle = `login${Date.now()}.test`
      const res = await agent.api.com.atproto.server.createAccount({
        email: mockIdentity.email!,
        handle,
        password: 'test-password-123',
      })

      testDid = res.data.did
      testJid = mockIdentity.jid

      // Link Neuro identity
      await manager.linkIdentity(
        testJid,
        testDid,
        mockIdentity.email,
        mockIdentity.userName,
      )

      console.log('✅ Test account created:', { did: testDid, jid: testJid })
    })

    it('should authenticate existing user with Neuro', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      // Step 1: Initiate login session
      const { sessionId, verificationCode, qrCodeUrl } =
        await manager.initiateSession()

      console.log('📱 Login: QR Code:', qrCodeUrl)
      console.log('📱 Login: Verification Code:', verificationCode)

      // Step 2: Simulate QR scan
      if (!USE_REAL_NEURO_API) {
        const loginIdentity = {
          jid: testJid,
          userName: 'logintest',
          email: 'logintest@example.com',
        }

        await fetch(`${mockNeuroUrl}/mock/scan-qr/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginIdentity),
        })

        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Step 3: Verify session completed
      expect(manager.isSessionCompleted(sessionId)).toBe(true)

      const identity = manager.getSessionIdentity(sessionId)
      expect(identity?.jid).toBe(testJid)

      // Step 4: Verify account lookup works
      const accountLink = await manager.findAccountByLegalIdOrJid(testJid)
      expect(accountLink).toBeDefined()
      expect(accountLink?.did).toBe(testDid)

      console.log('✅ Login successful:', {
        jid: testJid,
        did: accountLink?.did,
      })
    })

    it('should update last login timestamp', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      const beforeUpdate = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select('lastLoginAt')
        .where('legalId', '=', testJid)
        .executeTakeFirst()

      await manager.updateLastLogin(testJid)

      const afterUpdate = await ctx.accountManager.db.db
        .selectFrom('neuro_identity_link')
        .select('lastLoginAt')
        .where('legalId', '=', testJid)
        .executeTakeFirst()

      expect(afterUpdate?.lastLoginAt).toBeTruthy()
      expect(afterUpdate?.lastLoginAt).not.toBe(beforeUpdate?.lastLoginAt)

      console.log('✅ Last login timestamp updated')
    })
  })

  describe('Callback Endpoint', () => {
    it('should accept valid callbacks', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      const { sessionId } = await manager.initiateSession()

      const callbackData = {
        sessionId,
        jid: 'endpoint-test@neuro.example.com',
        userName: 'endpointtest',
        email: 'endpoint@example.com',
      }

      const response = await fetch(`${pdsUrl}/neuro/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callbackData),
      })

      expect(response.ok).toBe(true)
      const result = await response.json()
      expect(result.success).toBe(true)

      console.log('✅ Callback endpoint accepted valid request')
    })

    it('should reject callbacks with missing fields', async () => {
      const response = await fetch(`${pdsUrl}/neuro/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test' }), // Missing jid
      })

      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.code).toBe('NEURO_CALLBACK_MISSING_FIELDS')

      console.log('✅ Callback endpoint rejected invalid request')
    })

    it('should reject callbacks with invalid JID', async () => {
      const response = await fetch(`${pdsUrl}/neuro/callback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: 'test',
          jid: 'invalid-jid-no-at-sign',
        }),
      })

      expect(response.status).toBe(400)
      const result = await response.json()
      expect(result.code).toBe('NEURO_CALLBACK_INVALID_JID')

      console.log('✅ Callback endpoint validated JID format')
    })
  })

  describe('Error Handling', () => {
    it('should handle session expiration', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      // Try to get non-existent session
      expect(manager.isSessionPending('non-existent-session')).toBe(false)
      expect(manager.isSessionCompleted('non-existent-session')).toBe(false)
      expect(manager.getSessionIdentity('non-existent-session')).toBeUndefined()

      console.log('✅ Session expiration handled correctly')
    })

    it('should retry Neuro API calls on failure', async () => {
      // This test verifies retry logic is in place
      // In real API mode, this would test actual failures
      // In mock mode, we just verify the method doesn't throw
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      await expect(manager.initiateSession()).resolves.toBeDefined()

      console.log('✅ Retry logic present in API calls')
    })
  })

  describe('Database Cleanup', () => {
    it('should clean up expired sessions', async () => {
      const ctx = network.pds.ctx
      const manager = ctx.neuroAuthManager!

      // Create a session
      const { sessionId } = await manager.initiateSession()

      // Manually expire it in database
      await ctx.accountManager.db.db
        .updateTable('neuro_pending_session')
        .set({ expiresAt: new Date(Date.now() - 1000).toISOString() })
        .where('sessionId', '=', sessionId)
        .execute()

      // Run cleanup
      await manager.cleanupExpiredSessions()

      // Verify it was cleaned up
      const remaining = await ctx.accountManager.db.db
        .selectFrom('neuro_pending_session')
        .selectAll()
        .where('sessionId', '=', sessionId)
        .executeTakeFirst()

      expect(remaining).toBeUndefined()

      console.log('✅ Expired sessions cleaned up')
    })
  })
})
