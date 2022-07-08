import express from 'express'
import WellKnown from './well-known.js'
import Account from './v1/account.js'
import API from './v1/api/index.js'
import Data from './v1/data/index.js'
import Session from './v1/session.js'

const router = express.Router()

router.use('/.well-known', WellKnown)
router.use('/.adx/v1/account', Account)
router.use('/.adx/v1/api', API)
router.use('/.adx/v1/data', Data)
router.use('/.adx/v1/session', Session)

export default router
