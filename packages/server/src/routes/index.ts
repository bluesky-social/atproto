import express from 'express'
import WellKnown from './well-known'
import ID from './id'
import Data from './data'
import Indexer from './indexer'
import DidNetwork from './did-network'
import AIC from './aic'
import path from 'path'
import { fileURLToPath } from 'url'

const router = express.Router()

router.use('/.well-known', WellKnown)
router.use('/id', ID)
router.use('/data', Data)
router.use('/indexer', Indexer)
router.use('/did-network', DidNetwork)
router.use('/aic', AIC)
router.use('/favicon.ico', async (req, res) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return res.sendFile(path.resolve(__dirname, '../../src/static/favicon.ico'))
})
// router.use('/favicon.ico', express.static('static'))

export default router
