import express from 'express'
import { z } from 'zod'
import { ServerError } from '../error.js'
import { SERVER_DID } from '../server-identity.js'
import * as util from '../util.js'

const router = express.Router()

// Return the server's did
router.get('/did.json', (_req, res) => {
  return res.send({ id: SERVER_DID })
})

const webfingerReq = z.object({
  resource: z.string(),
})
export type WebfingerReq = z.infer<typeof webfingerReq>

// Retrieve a user's DID by their username
router.get('/webfinger', async (req, res) => {
  const { resource } = util.checkReqBody(req.query, webfingerReq)
  const db = util.getDB(res)
  const host = req.get('host')
  if (!host) {
    throw new ServerError(500, 'Could not get own host')
  }
  const did = await db.getDidForUser(resource, host)
  if (!did) {
    return res.status(404).send('User DID not found')
  }
  // @TODO: sketch out more of a webfinger doc
  return res.status(200).send({ id: did })
})

export default router
