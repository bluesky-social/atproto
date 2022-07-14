import express from 'express'
import * as util from '../util'

const router = express.Router()

router.get('/adx-did', (_req, res) => {
  const keypair = util.getKeypair(res)
  // Return the server's did
  // TODO check host header
  return res.send(keypair.did())
})

export default router
