import express from 'express'
import WellKnown from './well-known'
import Account from './v1/account'
import API from './v1/api/index'
import Data from './v1/data/index'
import Session from './v1/session'
import DidNetwork from './did-network'
import Indexer from './v1/indexer'

const router = express.Router()

router.use('/did-network', DidNetwork)
router.use('/.well-known', WellKnown)
router.use('/.adx/v1/account', Account)
router.use('/.adx/v1/api', API)
router.use('/.adx/v1/data', Data)
router.use('/.adx/v1/session', Session)
router.use('/.adx/v1/indexer', Indexer)

export default router
