import express from 'express'
import Root from './root'
import Repo from './repo'
import Subscribe from './subscribe'

const router = express.Router()

router.use('/root', Root)
router.use('/repo', Repo)
// router.use('/subscribe', Subscribe)

export default router
