import express from 'express'
import * as util from '../util'
import { UserDid } from '../db/user-dids'

const router = express.Router()

// did:web endpoint
router.get('/did.json', async (req, res) => {
  const { db, config } = util.getLocals(res)
  const hostname = req.hostname

  let userDidRecord: UserDid | null = null
  try {
    userDidRecord = await db.getUser(hostname)
  } catch (e) {
    console.error(`Error looking up user in did:web route`)
    console.error(e)
    return res.status(500).end()
  }

  if (!userDidRecord) {
    return res.status(404).end()
  }
  if (userDidRecord.did !== `did:web:${hostname}`) {
    return res.status(404).end()
  }
  // TODO
  // do we need to further verify this is a hostname we're controlling?
  // concerned about a forged Host header
  // -prf

  return res.json({
    '@context': ['https://www.w3.org/ns/did/v1'],
    id: userDidRecord.did,
    alsoKnownAs: `https://${userDidRecord.username}`,
    verificationMethod: [
      // TODO
    ],
    service: [
      {
        id: `${userDidRecord.did}#atpPds`,
        type: 'AtpPersonalDataServer',
        serviceEndpoint: config.origin,
      },
    ],
  })
})

export default router
