import express from 'express'
import { Request, Response } from 'express'
import cors from 'cors'

import { CarReader } from '@ipld/car'


const app = express()
app.use(express.json())
app.use(cors())

const readReqStream = (req: Request): Promise<Buffer> => {
  return new Promise(resolve => {
    const bufs = [] as Buffer[]
    req.on('data', (chunk: Buffer) => {
      bufs.push(chunk)
    })
    req.on('end', () => {
      resolve(Buffer.concat(bufs))
    })
  })
}

app.post('/update', async (req: Request, res: Response) => {
  const buf = await readReqStream(req)
  const reader = await CarReader.fromBytes(buf)
  console.log(reader)
  const roots = await reader.getRoots()
  console.log(roots)
  // req.on('data', (chunk) => {
  //   console.log(chunk)
  //   console.log(chunk.toString())
  // })
  // req.on('end', () => {
  //   console.log("DONE")
  //   res.status(200).send()
  // })
})


const runServer = (port = 1337) => {
  app.listen(port, () => {
    console.log(`🐦 Twitter is running at http://localhost:${port}`)
  })
}

runServer()
