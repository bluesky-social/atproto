import express from 'express'
<<<<<<< HEAD:packages/server/src/routes/data/index.ts
import Root from './root'
import Repo from './repo'
import Post from './post'
import Interaction from './interaction'
import Relationship from './relationship'
import Subscribe from './subscribe'
=======
import Root from './root.js'
import Repo from './repo.js'
import Subscribe from './subscribe.js'
>>>>>>> cab993c (WIP API branch squash):packages/server/src/routes/v1/data/index.ts

const router = express.Router()

router.use('/root', Root)
router.use('/repo', Repo)
router.use('/subscribe', Subscribe)

export default router
