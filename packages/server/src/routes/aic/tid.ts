import express from 'express'
import { TID } from '@adxp/common'
import { sign } from '@adxp/aic'
import { CONSORTIUM_KEYPAIR } from './index'
import {verifyDidSig} from '@adxp/crypto'

const router = express.Router()

let consortiumCrypto = async () => {
  let key = (await CONSORTIUM_KEYPAIR)
  return {
  did: (): string => { return key.did() },
  sign: async (msg:Uint8Array): Promise<Uint8Array> => {
    return await key.sign(msg)
  },
  verifyDidSig: verifyDidSig,
}
}

router.all('/', async (req, res) => {
  res.send(
    await sign(
      {
        tid: TID.next().formatted(),
        key: (await consortiumCrypto()).did(),
        sig: '',
      },
      await consortiumCrypto(),
    ),
  )
})

export default router
