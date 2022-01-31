import express from 'express'
import cors from 'cors'
import Routes from './routes'
import { Blockstore } from '@bluesky-demo/common'

const app = express()
app.use(express.json())
app.use(cors())

// attach blockstore instance
const blockstore = new Blockstore()
app.use((req, res, next) => {
  res.locals.blockstore = blockstore
  next()
})

app.use('/', Routes)

const PORT = 2583
app.listen(PORT, () => {
  console.log(`🐦 Bluesky server is running at http://localhost:${PORT}`)
})
