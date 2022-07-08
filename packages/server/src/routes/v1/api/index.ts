import express from 'express'
import Repo from './repo.js'
import View from './view.js'

const router = express.Router()

router.use('/repo', Repo)
router.use('/view', View)

export default router
