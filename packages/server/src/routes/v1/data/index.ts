import express from 'express'
import Root from './root'
import Repo from './repo'
import Subscribe from './subscribe'
import Relationship from './relationship'
import Post from './post'
import Interaction from './interaction'

const router = express.Router()

router.use('/root', Root)
router.use('/repo', Repo)
router.use('/relationship', Relationship)
router.use('/subscribe', Subscribe)
router.use('/post', Post)
router.use('/interaction', Interaction)

export default router
