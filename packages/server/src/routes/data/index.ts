import express from 'express'
import Root from './root'
import Repo from './repo'
import Post from './post'
import Interaction from './interaction'
import Relationship from './relationship'
import Subscribe from './subscribe'

const router = express.Router()

router.use('/root', Root)
router.use('/repo', Repo)
router.use('/post', Post)
router.use('/interaction', Interaction)
router.use('/relationship', Relationship)
router.use('/subscribe', Subscribe)

export default router
