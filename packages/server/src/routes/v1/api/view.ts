import express from 'express'
import * as util from '../../../util'
import { ServerError } from '../../../error'

const router = express.Router()

router.get('/:viewId', async (req, res) => {
  const { viewId } = req.params

  const query = req.query
  for (const [key, val] of Object.entries(query)) {
    if (typeof val !== 'string') {
      throw new ServerError(400, `Could not parse view param: ${key}`)
    }
    query[key] = decodeURIComponent(val)
  }

  // let parsedParams: Record<string, unknown>
  // try {
  //   const utf8 = uint8arrays.toString(
  //     uint8arrays.fromString(params, 'base64url'),
  //     'utf8',
  //   )
  //   parsedParams = JSON.parse(utf8)
  // } catch (err) {
  //   throw new ServerError(400, `Could not parse base64 view params: ${err}`)
  // }

  const db = util.getDB(res)
  const view = db.views[viewId]
  if (!view) {
    throw new ServerError(400, `A view does not exist with the id: ${viewId}`)
  }
  const viewRes = await view(query)
  res.status(200).send(viewRes)
})

export default router
