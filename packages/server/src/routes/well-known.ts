import express from 'express'
import * as locals from '../locals'

const router = express.Router()

// did:web endpoint
router.get('/did.json', async (req, res) => {
  const { db, config } = locals.get(res)
  const hostname = req.hostname

  let userRecord: { username: string; did: string } | null = null
  try {
    userRecord = await db.getUser(hostname)
  } catch (e) {
    return res.status(500).end()
  }

  if (!userRecord) {
    return res.status(404).end()
  }
  if (userRecord.did !== `did:web:${hostname}`) {
    return res.status(404).end()
  }
  // TODO
  // do we need to further verify this is a hostname we're controlling?
  // concerned about a forged Host header
  // -prf

  return res.json({
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: userRecord.did,
    alsoKnownAs: `https://${userRecord.username}`,
    verificationMethod: [
      // TODO
    ],
    service: [
      {
        id: `${userRecord.did}#atpPds`,
        type: 'AtpPersonalDataServer',
        serviceEndpoint: config.origin,
      },
    ],
  })
})

export default router
