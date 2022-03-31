import express from 'express'
import Timeline from './timeline.js'

const router = express.Router()

router.use('/timeline', Timeline)

export default router
