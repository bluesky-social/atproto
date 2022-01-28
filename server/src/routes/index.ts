import express from 'express'
import WellKnown from './well-known'
import User from './user'
import Users from './users'

const router = express.Router()

router.use('/.well-known', WellKnown)
router.use('/user', User)
router.use('/users', Users)

export default router
