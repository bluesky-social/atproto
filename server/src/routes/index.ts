import express from 'express'
import WellKnown from './well-known.js'
import User from './user.js'
import Users from './users.js'

const router = express.Router()

router.use('/.well-known', WellKnown)
router.use('/user', User)
router.use('/users', Users)

export default router
