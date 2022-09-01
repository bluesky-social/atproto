import express from 'express'
// import { z } from 'zod'
// import * as auth from '../../../auth.js'
import * as util from '../../../util'
// import { ServerError } from '../../../error.js'
// import { flattenPost, schema, TID } from '@adxp/common'
// import * as subscriptions from '../../../subscriptions.js'

const router = express.Router()

router.get('/:viewId', async (req, res) => {
  // @TODO return a view
  // const { uri } = req.query
  // if (typeof uri !== 'string') {
  //   return res.sendStatus(500)
  // }
  const uri = 'adx://did:example:alice/bsky/posts/3jbmcvqpfkc2d'
  const db = util.getDB(res)
  const view = await db.views.likedBy({ uri })
  res.status(200).send(view)
})

export default router
