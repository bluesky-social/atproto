import express from 'express'
import * as ucan from 'ucans'
import { ucanCheck } from '@bluesky-demo/common'
import { SERVER_DID } from '../server-identity'

const router = express.Router()

router.post('/register', async (req, res) => {
  let u: ucan.Chained
  try {
    u = await ucanCheck.checkUcan(
      req,
      ucanCheck.hasAudience(SERVER_DID)
    )
  } catch(err) {
    res.status(401).send(err)
  }

  res.send(200)
})

router.post('/update', async (req, res) => {
})

router.get('/:id', (req, res) => {
})

export default router
