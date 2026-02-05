/**
 * Mock Neuro RemoteLogin Server
 *
 * Simulates the Neuro RemoteLogin API for local PDS testing.
 * Returns immediate success responses without actual authentication.
 */

const express = require('express')
const { SignJWT } = require('jose')
const crypto = require('crypto')

const app = express()
app.use(express.json())

// Configuration
const PORT = process.env.PORT || 8080
const CALLBACK_DELAY_MS = parseInt(process.env.CALLBACK_DELAY_MS || '2000')
const AUTO_APPROVE = process.env.AUTO_APPROVE !== 'false'
const MOCK_LEGAL_ID =
  process.env.MOCK_LEGAL_ID || 'test-guid@legal.lab.tagroot.io'
const MOCK_JID = process.env.MOCK_JID || 'testuser@lab.tagroot.io'

// In-memory petition storage
const petitions = new Map()

// Generate JWT signing key (HMAC secret for testing)
const JWT_SECRET = crypto.randomBytes(32)

/**
 * Generate a mock Neuro RemoteLogin JWT token
 */
async function generateNeuroJWT(legalId, audience, seconds = 300) {
  const now = Math.floor(Date.now() / 1000)

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setJti(crypto.randomBytes(16).toString('hex')) // JWT ID
    .setIssuer('lab.tagroot.io') // Issuer (Neuron domain)
    .setSubject(legalId) // Subject (Legal ID)
    .setAudience(audience) // Audience (PDS domain)
    .setIssuedAt(now) // Issued at
    .setExpirationTime(now + seconds) // Expiration
    .claim('client_id', legalId) // Client ID (same as subject)
    .sign(JWT_SECRET)

  return jwt
}

/**
 * Send callback to PDS
 */
async function sendCallback(callbackUrl, petitionId, approved = true) {
  console.log(`\n📞 Sending callback to: ${callbackUrl}`)
  console.log(`   Petition ID: ${petitionId}`)
  console.log(`   Approved: ${approved}`)

  const petition = petitions.get(petitionId)
  if (!petition) {
    console.error(`❌ Petition ${petitionId} not found`)
    return
  }

  let payload

  if (approved) {
    // Generate JWT token for successful authentication
    const token = await generateNeuroJWT(
      petition.address,
      petition.audience,
      petition.seconds,
    )

    payload = {
      PetitionId: petitionId,
      Rejected: false,
      Token: token,
    }

    console.log(`   ✅ Token generated (${token.substring(0, 50)}...)`)
  } else {
    payload = {
      PetitionId: petitionId,
      Rejected: true,
      Token: '',
    }

    console.log(`   ❌ Petition rejected`)
  }

  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (response.ok) {
      console.log(`   ✅ Callback sent successfully (${response.status})`)
    } else {
      const text = await response.text()
      console.error(`   ❌ Callback failed (${response.status}): ${text}`)
    }
  } catch (error) {
    console.error(`   ❌ Callback error: ${error.message}`)
  }
}

/**
 * POST /QuickLogin (Legacy API)
 *
 * Initiates a QuickLogin session (older API, user-initiated)
 */
app.post('/QuickLogin', async (req, res) => {
  console.log('\n🔐 POST /QuickLogin (Legacy)')
  console.log('Request body:', JSON.stringify(req.body, null, 2))

  const { callbackUrl, sessionId } = req.body

  // Validate required fields
  if (!callbackUrl || !sessionId) {
    console.error('❌ Missing required fields')
    return res.status(400).json({
      error: 'Missing required fields: callbackUrl, sessionId',
    })
  }

  // Generate service ID
  const serviceId = `mock-service-${crypto.randomBytes(8).toString('hex')}`

  console.log(`✅ QuickLogin session created: ${serviceId}`)
  console.log(`   Session ID: ${sessionId}`)
  console.log(`   Callback URL: ${callbackUrl}`)

  // Store session
  petitions.set(sessionId, {
    serviceId,
    sessionId,
    callbackUrl,
    createdAt: Date.now(),
    type: 'QuickLogin',
  })

  // Return service ID immediately
  res.json({ serviceId })

  // Schedule automatic callback if enabled
  if (AUTO_APPROVE) {
    console.log(
      `⏱️  Scheduling automatic QuickLogin callback in ${CALLBACK_DELAY_MS}ms...`,
    )
    setTimeout(async () => {
      console.log(`\n📞 Sending QuickLogin callback to: ${callbackUrl}`)

      // QuickLogin callback payload (legacy format)
      const identity = {
        sessionId,
        jid: MOCK_JID,
        userName: MOCK_JID.split('@')[0],
        legalId: MOCK_LEGAL_ID,
        email: `${MOCK_JID.split('@')[0]}@example.com`,
        phoneNumber: '+1234567890',
        firstName: 'Test',
        lastName: 'User',
        profilePictureUrl: null,
        publicKey: null,
      }

      console.log('   Identity:', JSON.stringify(identity, null, 2))

      try {
        const response = await fetch(callbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(identity),
        })

        if (response.ok) {
          console.log(
            `   ✅ QuickLogin callback sent successfully (${response.status})`,
          )
        } else {
          const text = await response.text()
          console.error(
            `   ❌ QuickLogin callback failed (${response.status}): ${text}`,
          )
        }
      } catch (error) {
        console.error(`   ❌ QuickLogin callback error: ${error.message}`)
      }
    }, CALLBACK_DELAY_MS)
  } else {
    console.log(
      `⏸️  Auto-approve disabled. Use POST /mock/qr-scan/${sessionId} to trigger callback manually.`,
    )
  }
})

/**
 * POST /mock/qr-scan/:sessionId
 *
 * Manually trigger QuickLogin callback (simulates QR code scan)
 */
app.post('/mock/qr-scan/:sessionId', async (req, res) => {
  const { sessionId } = req.params

  console.log(`\n📷 Manual QR scan for session: ${sessionId}`)

  const session = petitions.get(sessionId)
  if (!session || session.type !== 'QuickLogin') {
    console.error(`❌ QuickLogin session not found: ${sessionId}`)
    return res.status(404).json({ error: 'QuickLogin session not found' })
  }

  // Allow custom identity in request body
  const customJid = req.body.jid || MOCK_JID
  const customLegalId = req.body.legalId || MOCK_LEGAL_ID

  const identity = {
    sessionId,
    jid: customJid,
    userName: req.body.userName || customJid.split('@')[0],
    legalId: customLegalId,
    email: req.body.email || `${customJid.split('@')[0]}@example.com`,
    phoneNumber: req.body.phoneNumber || '+1234567890',
    firstName: req.body.firstName || 'Test',
    lastName: req.body.lastName || 'User',
    profilePictureUrl: req.body.profilePictureUrl || null,
    publicKey: req.body.publicKey || null,
  }

  console.log('   Sending identity:', JSON.stringify(identity, null, 2))

  try {
    const response = await fetch(session.callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(identity),
    })

    if (response.ok) {
      console.log(`   ✅ Callback sent successfully (${response.status})`)
      res.json({ success: true, sessionId })
    } else {
      const text = await response.text()
      console.error(`   ❌ Callback failed (${response.status}): ${text}`)
      res.status(500).json({ error: `Callback failed: ${text}` })
    }
  } catch (error) {
    console.error(`   ❌ Callback error: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
})

/**
 * POST /RemoteLogin
 *
 * Initiates a remote login petition (mock implementation)
 */
app.post('/RemoteLogin', async (req, res) => {
  console.log('\n🔐 POST /RemoteLogin')
  console.log('Request body:', JSON.stringify(req.body, null, 2))

  const {
    AddressType,
    Address,
    ResponseMethod,
    CallbackURL,
    Seconds = 300,
    Purpose,
  } = req.body

  // Validate required fields
  if (!AddressType || !Address || !ResponseMethod) {
    console.error('❌ Missing required fields')
    return res.status(400).json({
      error: 'Missing required fields: AddressType, Address, ResponseMethod',
    })
  }

  // Only support Callback method for now
  if (ResponseMethod !== 'Callback') {
    console.error(`❌ Unsupported response method: ${ResponseMethod}`)
    return res.status(400).json({
      error: 'Only ResponseMethod=Callback is supported in mock server',
    })
  }

  if (!CallbackURL) {
    console.error('❌ CallbackURL required for Callback response method')
    return res.status(400).json({
      error: 'CallbackURL is required when ResponseMethod=Callback',
    })
  }

  // Generate petition ID
  const petitionId = `mock-petition-${crypto.randomBytes(8).toString('hex')}`

  // Extract audience from callback URL
  let audience = 'localhost:3000'
  try {
    const url = new URL(CallbackURL)
    audience = url.host
  } catch (e) {
    console.warn(`⚠️  Could not parse CallbackURL, using default audience`)
  }

  // Store petition
  petitions.set(petitionId, {
    addressType: AddressType,
    address: Address,
    callbackUrl: CallbackURL,
    seconds: Seconds,
    purpose: Purpose,
    audience: audience,
    createdAt: Date.now(),
  })

  console.log(`✅ Petition created: ${petitionId}`)
  console.log(`   Address Type: ${AddressType}`)
  console.log(`   Address: ${Address}`)
  console.log(`   Purpose: ${Purpose}`)
  console.log(`   Callback URL: ${CallbackURL}`)
  console.log(`   Audience: ${audience}`)

  // Return petition ID immediately
  res.json({ PetitionId: petitionId })

  // Schedule automatic callback if enabled
  if (AUTO_APPROVE) {
    console.log(
      `⏱️  Scheduling automatic approval in ${CALLBACK_DELAY_MS}ms...`,
    )
    setTimeout(() => {
      sendCallback(CallbackURL, petitionId, true)
    }, CALLBACK_DELAY_MS)
  } else {
    console.log(
      `⏸️  Auto-approve disabled. Use POST /mock/approve/${petitionId} to approve manually.`,
    )
  }
})

/**
 * POST /mock/approve/:petitionId
 *
 * Manually approve a petition (for testing)
 */
app.post('/mock/approve/:petitionId', async (req, res) => {
  const { petitionId } = req.params

  console.log(`\n✅ Manual approval requested for: ${petitionId}`)

  const petition = petitions.get(petitionId)
  if (!petition) {
    console.error(`❌ Petition not found: ${petitionId}`)
    return res.status(404).json({ error: 'Petition not found' })
  }

  await sendCallback(petition.callbackUrl, petitionId, true)
  res.json({ success: true, petitionId })
})

/**
 * POST /mock/reject/:petitionId
 *
 * Manually reject a petition (for testing)
 */
app.post('/mock/reject/:petitionId', async (req, res) => {
  const { petitionId } = req.params

  console.log(`\n❌ Manual rejection requested for: ${petitionId}`)

  const petition = petitions.get(petitionId)
  if (!petition) {
    console.error(`❌ Petition not found: ${petitionId}`)
    return res.status(404).json({ error: 'Petition not found' })
  }

  await sendCallback(petition.callbackUrl, petitionId, false)
  res.json({ success: true, petitionId })
})

/**
 * GET /mock/petitions
 *
 * List all active petitions (for debugging)
 */
app.get('/mock/petitions', (req, res) => {
  const petitionList = Array.from(petitions.entries()).map(([id, data]) => ({
    petitionId: id,
    ...data,
  }))

  res.json({
    count: petitionList.length,
    petitions: petitionList,
  })
})

/**
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'mock-neuro-server',
    config: {
      autoApprove: AUTO_APPROVE,
      callbackDelayMs: CALLBACK_DELAY_MS,
      mockLegalId: MOCK_LEGAL_ID,
      mockJid: MOCK_JID,
    },
  })
})

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60))
  console.log('🚀 Mock Neuro RemoteLogin Server Started')
  console.log('='.repeat(60))
  console.log(`\n📡 Listening on: http://localhost:${PORT}`)
  console.log(`\n⚙️  Configuration:`)
  console.log(`   - Auto-approve: ${AUTO_APPROVE}`)
  console.log(`   - Callback delay: ${CALLBACK_DELAY_MS}ms`)
  console.log(`   - Mock Legal ID: ${MOCK_LEGAL_ID}`)
  console.log(`   - Mock JID: ${MOCK_JID}`)
  console.log(`\n📚 Available Endpoints:`)
  console.log(
    `   POST /QuickLogin            - Create QuickLogin session (legacy)`,
  )
  console.log(`   POST /mock/qr-scan/:id      - Trigger QuickLogin callback`)
  console.log(`   POST /RemoteLogin           - Create RemoteLogin petition`)
  console.log(`   POST /mock/approve/:id      - Manually approve a petition`)
  console.log(`   POST /mock/reject/:id       - Manually reject a petition`)
  console.log(`   GET  /mock/petitions        - List all petitions`)
  console.log(`   GET  /health                - Health check`)
  console.log('\n' + '='.repeat(60) + '\n')
})

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down mock server...')
  process.exit(0)
})
