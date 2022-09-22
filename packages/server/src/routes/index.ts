import express from 'express'
import WellKnown from './well-known'
const router = express.Router()

router.use('/.well-known', WellKnown)

export default router
