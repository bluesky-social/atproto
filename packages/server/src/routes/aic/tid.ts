import express from 'express'
import { TID } from '@adxp/common'
import { sign } from '@adxp/aic'
import { CONSORTIUM_KEYPAIR } from './index.js'

const router = express.Router()

router.all('/', async (req, res) => {
  res.send(
    await sign(
      {
        tid: TID.next().formatted(),
        key: (await CONSORTIUM_KEYPAIR).did(),
        sig: '',
      },
      await CONSORTIUM_KEYPAIR,
    ),
  )
})

export default router
