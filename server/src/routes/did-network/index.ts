import express from 'express'
import { z } from 'zod'

import * as ucan from 'ucans'
import * as util from '../../util.js'
import { ServerError } from '../../error.js'

const router = express.Router()

export const postDidNetworkReq = z.object({
  did: z.string(),
  username: z.string(),
  signature: z.string(),
})
export type PostDidNetworkReq = z.infer<typeof postDidNetworkReq>

router.post('/', async (req, res) => {
  const { username, did, signature } = util.checkReqBody(
    req.body,
    postDidNetworkReq,
  )
  if (username.startsWith('did:')) {
    throw new ServerError(
      400,
      'Cannot register a username that starts with `did:`',
    )
  }
  const { db } = util.getLocals(res)
  const validSig = await ucan.verifySignatureUtf8(username, signature, did)
  if (!validSig) {
    throw new ServerError(403, 'Not a valid signature on username')
  }

  const [name, host] = username.split('@')
  if (!host) {
    throw new ServerError(400, 'Poorly formatted username, expected `@`')
  }

  await db.registerOnDidNetwork(name, did, host)

  return res.sendStatus(200)
})

export const getDidNetworkReq = z.object({
  did: z.string(),
})
export type GetDidNetworkReq = z.infer<typeof getDidNetworkReq>

router.get('/', async (req, res) => {
  const { did } = util.checkReqBody(req.query, getDidNetworkReq)
  const { db } = util.getLocals(res)
  const username = await db.getUsernameFromDidNetwork(did)
  if (username === null) {
    throw new ServerError(404, 'Could not find user')
  }
  res.send({ username })
})

export default router
