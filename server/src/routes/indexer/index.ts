import express from 'express'
import Timeline from './timeline.js'
import Feed from './feed.js'
import PostInfo from './post-info.js'
import Count from './count.js'
import Followers from './followers.js'
import AccountInfo from './account-info.js'

const router = express.Router()

router.use('/timeline', Timeline)
router.use('/feed', Feed)
router.use('/post-info', PostInfo)
router.use('/count', Count)
router.use('/followers', Followers)
router.use('/account-info', AccountInfo)

export default router
