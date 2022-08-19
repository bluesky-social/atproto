import express from 'express'
import WellKnown from './well-known'
import Account from './v1/account'
import API from './v1/api/index'
import Data from './v1/data/index'
import Session from './v1/session'
import Database from '../db'
import { AdxUri } from '@adxp/common'

const router = express.Router()

router.get('/test', async (req, res) => {
  const db: Database = res.locals.db
  const uri = new AdxUri('adx://did:example/bsky/posts/1234')

  console.log('uri: ', uri.toString())

  await db.addRecord(uri, {
    $type: 'blueskyweb.xyz:Post',
    text: 'asodfiuer',
    createdAt: new Date().toISOString(),
  })

  const got = await db.records.posts.get(uri)
  console.log('got: ', got)

  res.status(200).send()
})

// router.use('/.well-known', WellKnown)
// router.use('/.adx/v1/account', Account)
// router.use('/.adx/v1/api', API)
// router.use('/.adx/v1/data', Data)
// router.use('/.adx/v1/session', Session)

export default router
