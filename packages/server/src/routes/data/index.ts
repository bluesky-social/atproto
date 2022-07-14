import express from 'express'
import Root from './root.js'
import Repo from './repo.js'
import Subscribe from './subscribe.js'

const router = express.Router()

router.use('/root', Root)
router.use('/repo', Repo)
router.use('/subscribe', Subscribe)

export default router
