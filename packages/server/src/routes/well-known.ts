import express from 'express'
import { z } from 'zod'
import * as util from '../util'

const router = express.Router()

router.get('/adx-did', (_req, res) => {
  // Return the server's did
  // TODO check host header
  return res.send(SERVER_DID)
})

export default router
