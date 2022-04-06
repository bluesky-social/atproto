import express from 'express'
import Timeline from './timeline.js'
import Count from './count.js'
import Followers from './followers.js'

const router = express.Router()

router.use('/timeline', Timeline)
router.use('/count', Count)
router.use('/followers', Followers)

export default router
