import express from 'express'
import * as UserDids from '../user-dids'

const router = express.Router()

router.get('/', async (req, res) => {
  const dids = await UserDids.listDids()
  res.status(200).send(dids)
})

export default router
