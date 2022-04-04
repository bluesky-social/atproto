import express from 'express'
import Timeline from './timeline.js'
import Count from './count.js'

const router = express.Router()

router.use('/timeline', Timeline)
router.use('/count', Count)

export default router
