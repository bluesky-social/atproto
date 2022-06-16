import express from 'express'
import cors from 'cors'
import Database from './db'
import * as ucan from 'ucans'

const app = express()
app.use(cors())
app.use(express.json())

app.post('/', async (req, res) => {
  const { username, signingKey, signature } = req.body
  if (
    typeof username !== 'string' ||
    typeof signingKey !== 'string' ||
    typeof signature !== 'string'
  ) {
    return res.status(400).send('Bad params')
  }
  if (username.startsWith('did:')) {
    return res
      .status(400)
      .send('Cannot register a username that starts with `did:`')
  }
  // @TODO calculate DID
  const did = 'asdf'
  const db: Database = res.locals.db
  const validSig = await ucan.verifySignatureUtf8(username, signature, did)
  if (!validSig) {
    return res.status(403).send('Not a valid signature on username')
  }

  const [name, host] = username.split('@')
  if (!host) {
    return res.status(400).send('Poorly formatted username, expected `@`')
  }

  await db.register(name, did, host, signingKey)

  return res.send({ did })
})

app.get('/', async (req, res) => {
  const { did } = req.body
  if (typeof did !== 'string') {
    return res.status(400).send('Bad params')
  }
  const db: Database = res.locals.db
  const info = await db.getInfo(did)
  if (info === null) {
    return res.status(404).send('Could not find user')
  }
  res.send(info)
})

export const runServer = (db: Database, port: number) => {
  app.use((_req, res, next) => {
    res.locals.db = db
    next()
  })

  app.listen(port, () => {
    console.log(`📰 DID network is running at http://localhost:${port}`)
  })
}

export default runServer
