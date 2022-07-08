import express from 'express'
<<<<<<< HEAD:packages/server/src/routes/index.ts
import WellKnown from './well-known'
import ID from './id'
import Data from './data'
import Indexer from './indexer'
import DidNetwork from './did-network'
=======
import WellKnown from './well-known.js'
import Account from './v1/account.js'
import API from './v1/api/index.js'
import Data from './v1/data/index.js'
import Session from './v1/session.js'
>>>>>>> cab993c (WIP API branch squash):server/src/routes/index.ts

const router = express.Router()

router.use('/.well-known', WellKnown)
router.use('/.adx/v1/account', Account)
router.use('/.adx/v1/api', API)
router.use('/.adx/v1/data', Data)
router.use('/.adx/v1/session', Session)

export default router
