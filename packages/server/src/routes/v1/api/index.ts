import express from 'express'
import Repo from './repo'
import View from './view'

const router = express.Router()

router.use('/repo', Repo)
router.use('/view', View)

export default router
