import express from 'express'
import { SERVER_DID } from '../server-identity'
import * as UserDids from '../user-dids'


const router = express.Router()

// Return the server's did
router.get('/did.json', (_req, res) => {
  res.send({ id: SERVER_DID })}
)

// Retrieve a user's DID by their username
router.get('/webfinger', async (req, res) => {
  const { resource }  = req.query
  if(typeof resource !== 'string') {
    return res.status(400).send("Bad param: expected `resource` to be a string")
  }

  const did = await UserDids.get(resource)
  if (!did) {
    return res.status(404).send("User DID not found")
  }
  res.status(200).send({ id: did })
})

export default router
