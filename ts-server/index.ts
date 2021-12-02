import express from 'express'
import cors from 'cors'


const app = express()
app.use(express.json())
app.use(cors())


const runServer = (port = 1337) => {
  app.listen(port, () => {
    console.log(`🐦 Twitter is running at http://localhost:${port}`)
  })
}

runServer()
