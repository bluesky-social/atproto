import express from 'express'
import { z } from 'zod'
import * as auth from '../../../auth.js'
import * as util from '../../../util.js'
import { ServerError } from '../../../error.js'
import { flattenPost, schema, TID, ucanCheck } from '@adxp/common'
import { SERVER_DID } from '../../../server-identity.js'
import * as subscriptions from '../../../subscriptions.js'

const router = express.Router()

router.get('/:viewId', async (req, res) => {
  // TODO return a view
  res.sendStatus(501)
})

export default router
