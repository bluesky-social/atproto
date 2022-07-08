import express from 'express'
import WellKnown from './well-known'
import ID from './id'
import Data from './data'
import Indexer from './indexer'
import DidNetwork from './did-network'

const router = express.Router()

router.use('/.well-known', WellKnown)
router.use('/id', ID)
router.use('/data', Data)
router.use('/indexer', Indexer)
router.use('/did-network', DidNetwork)

export default router
