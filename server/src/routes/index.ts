import express from 'express'
import WellKnown from './well-known.js'
import ID from './id.js'
import Data from './data/index.js'
import User from './user.js'

const router = express.Router()

router.use('/.well-known', WellKnown)
router.use('/id', ID)
router.use('/user', User)
router.use('/data', Data)

export default router
