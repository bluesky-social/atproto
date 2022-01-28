import express from 'express'
import cors from 'cors'
import Routes from './routes'

const app = express()
app.use(express.json())
app.use(cors())

app.use('/', Routes)

const PORT = 2583
app.listen(PORT, () => {
  console.log(`🐦 Bluesky server is running at http://localhost:${PORT}`)
})
