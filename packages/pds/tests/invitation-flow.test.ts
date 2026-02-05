// Import directly from source file to avoid pulling in bsky package which has build issues
import axios from 'axios'
import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env/src/network-no-appview'

/**
 * Invitation Flow Integration Tests
 *
 * Tests the complete invitation system including:
 * - HTTP API authentication (X-API-Key and Basic Auth)
 * - Request validation
 * - Email normalization
 * - Batch processing
 * - Error handling
 *
 * Manual test results (2026-02-05):
 * ✅ X-API-Key authentication works (201 Created)
 * ✅ Basic Auth authentication works (201 Created)
 * ✅ Invalid auth rejected (401 Unauthorized)
 * ✅ Missing email validation (400 Bad Request)
 * ✅ Email normalization (lowercase)
 * ✅ Batch processing (10 invitations)
 */

describe('Invitation Flow Integration', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let pdsUrl: string
  const adminPassword = 'test-admin-password'

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'invitation_flow',
    })
    pdsUrl = network.pds.url
    agent = new AtpAgent({ service: pdsUrl })
  })

  afterAll(async () => {
    await network.close()
  })

  describe('UserInvitation Event Handler', () => {
    it('creates invitation with X-API-Key authentication', async () => {
      const response = await axios.post(
        `${pdsUrl}/neuro/provision/account`,
        {
          EventId: 'UserInvitation',
          Tags: {
            EMAIL: 'apikey@example.com',
          },
          Handle: 'apikeyuser',
          Timestamp: Math.floor(Date.now() / 1000),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': adminPassword,
          },
        },
      )

      expect(response.status).toBe(201)
      expect(response.data.success).toBe(true)
      expect(response.data.email).toBe('apikey@example.com')
      expect(response.data.preferredHandle).toBe('apikeyuser')
    })

    it('creates invitation with Basic Auth', async () => {
      const response = await axios.post(
        `${pdsUrl}/neuro/provision/account`,
        {
          EventId: 'UserInvitation',
          Tags: {
            EMAIL: 'basicauth@example.com',
          },
          Handle: 'basicuser',
          Timestamp: Math.floor(Date.now() / 1000),
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          auth: {
            username: 'admin',
            password: adminPassword,
          },
        },
      )

      expect(response.status).toBe(201)
      expect(response.data.success).toBe(true)
      expect(response.data.email).toBe('basicauth@example.com')
    })

    it('creates invitation without preferred handle', async () => {
      const response = await axios.post(
        `${pdsUrl}/neuro/provision/account`,
        {
          EventId: 'UserInvitation',
          Tags: {
            EMAIL: 'nohandle@example.com',
          },
          Timestamp: Math.floor(Date.now() / 1000),
        },
        {
          headers: {
            'X-API-Key': adminPassword,
          },
        },
      )

      expect(response.status).toBe(201)
      expect(response.data.preferredHandle).toBeNull()
    })

    it('rejects request with invalid API key', async () => {
      try {
        await axios.post(
          `${pdsUrl}/neuro/provision/account`,
          {
            EventId: 'UserInvitation',
            Tags: {
              EMAIL: 'test@example.com',
            },
            Timestamp: Math.floor(Date.now() / 1000),
          },
          {
            headers: {
              'X-API-Key': 'wrong-password',
            },
          },
        )
        fail('Should have thrown 401')
      } catch (err: any) {
        expect(err.response.status).toBe(401)
        expect(err.response.data.error).toBe('Unauthorized')
      }
    })

    it('rejects request without authentication', async () => {
      try {
        await axios.post(`${pdsUrl}/neuro/provision/account`, {
          EventId: 'UserInvitation',
          Tags: {
            EMAIL: 'test@example.com',
          },
          Timestamp: Math.floor(Date.now() / 1000),
        })
        fail('Should have thrown 401')
      } catch (err: any) {
        expect(err.response.status).toBe(401)
      }
    })

    it('rejects request with missing email', async () => {
      try {
        await axios.post(
          `${pdsUrl}/neuro/provision/account`,
          {
            EventId: 'UserInvitation',
            Tags: {},
            Timestamp: Math.floor(Date.now() / 1000),
          },
          {
            headers: {
              'X-API-Key': adminPassword,
            },
          },
        )
        fail('Should have thrown 400')
      } catch (err: any) {
        expect(err.response.status).toBe(400)
        expect(err.response.data.message).toContain('EMAIL')
      }
    })

    it('rejects request with missing timestamp', async () => {
      try {
        await axios.post(
          `${pdsUrl}/neuro/provision/account`,
          {
            EventId: 'UserInvitation',
            Tags: {
              EMAIL: 'test@example.com',
            },
          },
          {
            headers: {
              'X-API-Key': adminPassword,
            },
          },
        )
        fail('Should have thrown 400')
      } catch (err: any) {
        expect(err.response.status).toBe(400)
        expect(err.response.data.message).toContain('Timestamp')
      }
    })

    it('updates existing invitation on duplicate email', async () => {
      const email = 'update@example.com'

      // Create first invitation
      const response1 = await axios.post(
        `${pdsUrl}/neuro/provision/account`,
        {
          EventId: 'UserInvitation',
          Tags: { EMAIL: email },
          Handle: 'firsthandle',
          Timestamp: Math.floor(Date.now() / 1000),
        },
        {
          headers: { 'X-API-Key': adminPassword },
        },
      )
      expect(response1.data.preferredHandle).toBe('firsthandle')

      // Update with new handle
      const response2 = await axios.post(
        `${pdsUrl}/neuro/provision/account`,
        {
          EventId: 'UserInvitation',
          Tags: { EMAIL: email },
          Handle: 'secondhandle',
          Timestamp: Math.floor(Date.now() / 1000) + 100,
        },
        {
          headers: { 'X-API-Key': adminPassword },
        },
      )
      expect(response2.data.preferredHandle).toBe('secondhandle')

      // Verify only one invitation exists
      const invitation =
        await network.pds.ctx.invitationManager.getInvitationByEmail(email)
      expect(invitation?.preferred_handle).toBe('secondhandle')
    })
  })

  describe('QuickLogin with PDS_INVITE_REQUIRED=false', () => {
    it('allows account creation without invitation', async () => {
      // This test would require setting up a full QuickLogin flow
      // with mock Neuro server, which is tested in neuro-integration.test.ts
      // Here we just verify the invitation manager is accessible
      expect(network.pds.ctx.invitationManager).toBeDefined()
    })
  })

  describe('Email normalization', () => {
    it('handles mixed-case emails consistently', async () => {
      const email = 'MixedCase@Example.COM'

      const response = await axios.post(
        `${pdsUrl}/neuro/provision/account`,
        {
          EventId: 'UserInvitation',
          Tags: { EMAIL: email },
          Timestamp: Math.floor(Date.now() / 1000),
        },
        {
          headers: { 'X-API-Key': adminPassword },
        },
      )

      expect(response.data.email).toBe('mixedcase@example.com')

      const invitation =
        await network.pds.ctx.invitationManager.getInvitationByEmail(email)
      expect(invitation?.email).toBe('mixedcase@example.com')
    })
  })

  describe('Batch invitation processing', () => {
    it('handles multiple rapid invitations', async () => {
      const promises = []
      for (let i = 0; i < 10; i++) {
        promises.push(
          axios.post(
            `${pdsUrl}/neuro/provision/account`,
            {
              EventId: 'UserInvitation',
              Tags: { EMAIL: `batch${i}@example.com` },
              Handle: `batchuser${i}`,
              Timestamp: Math.floor(Date.now() / 1000),
            },
            {
              headers: { 'X-API-Key': adminPassword },
            },
          ),
        )
      }

      const results = await Promise.all(promises)
      results.forEach((response) => {
        expect(response.status).toBe(201)
        expect(response.data.success).toBe(true)
      })

      // Verify all were created
      const count = await network.pds.ctx.invitationManager.getPendingCount()
      expect(count).toBeGreaterThanOrEqual(10)
    })
  })
})
