import express from 'express'
import { z } from 'zod'

const router = express.Router()

export const registerReq = z.object({
  did: z.string(),
  username: z.string(),
  createRepo: z.boolean(),
})
export type RegisterReq = z.infer<typeof registerReq>

router.get('/', async (req, res) => {
  // TODO get current session
  return res.sendStatus(501)
})

router.post('/', async (req, res) => {
  // TODO trade a UCAN for a session token
  return res.sendStatus(501)
})

router.post('/', async (req, res) => {
  // TODO delete the current session
  return res.sendStatus(501)
})

export default router
