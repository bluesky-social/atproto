import express from 'express'
import * as UserDids from '../db/user-dids.js'
import * as util from '../util.js'

const router = express.Router()

router.post('/register', async (req, res) => {
  // use UCAN validation for this
  const { username, did } = req.body
  const db = util.getDB(res)
  await UserDids.register(db, username, did)
  return res.sendStatus(200)
})

export default router
