import express from 'express'
import cors from 'cors'
import KeyManagerDb from './db'
import * as crypto from '@adxp/crypto'

export const runServer = (
  db: KeyManagerDb,
  port: number,
): Promise<Express.Application> => {
  const app = express()
  app.use(cors())

  app.use((_req, res, next) => {
    res.locals.db = db
    next()
  })

  // request ucan
  app.get('/ucan', async (req, res) => {
    res.send(200)
  })

  // create root keypair + DID
  app.post('/account', async (req, res) => {
    const keypair = await crypto.EcdsaKeypair.create({ exportable: true })

    res.send(200)
  })

  // request DID doc mutation

  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(
        `🔑 Key management server is running at http://localhost:${port}`,
      )
      resolve(app)
    })
  })
}

export default runServer
