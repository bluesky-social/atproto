import express from 'express'
import { SERVER_DID } from '../server-identity.js'
import * as util from '../util.js'

const router = express.Router()

// Return the server's did
router.get('/did.json', (_req, res) => {
  return res.send({ id: SERVER_DID })
})

// Retrieve a user's DID by their username
router.get('/webfinger', async (req, res) => {
  const { resource } = req.query
  if (typeof resource !== 'string') {
    return res.status(400).send('Bad param: expected `resource` to be a string')
  }
  const db = util.getDB(res)
  const did = await db.getDidForUser(resource)
  if (!did) {
    return res.status(404).send('User DID not found')
  }
  // @TODO: sketch out more of a webfinger doc
  return res.status(200).send({ id: did })
})

export default router
