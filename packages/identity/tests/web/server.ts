import express from 'express'
import cors from 'cors'
import http from 'http'
import DidWebDb from './db'
import { DidDocument } from '../../src'

const DOC_PATH = '/.well-known/did.json'

const routes = express.Router()

// Get DID Doc
routes.get('/*', async (req, res) => {
  const db = res.locals.db
  const got = await db.get(req.url)
  if (got === null) {
    return res.status(404).send('Not found')
  }
  res.type('application/did+ld+json')
  res.send(JSON.stringify(got))
})

// Write DID
routes.post('/', async (req, res) => {
  const { didDoc } = req.body
  if (!didDoc) {
    return res.status(400)
  }
  // @TODO add in some proof
  // @TODO validate didDoc body
  const db = res.locals.db
  const path = idToPath(didDoc.id)
  await db.put(path, didDoc)
  res.status(200).send()
})

const idToPath = (id: string): string => {
  const idp = id.split(':').slice(3)
  let path =
    idp.length > 0
      ? idp.map(decodeURIComponent).join('/') + '/did.json'
      : DOC_PATH

  if (!path.startsWith('/')) path = `/${path}`
  return path
}

export class DidWebServer {
  port: number
  private _db: DidWebDb
  _app: express.Application
  _httpServer: http.Server | null = null

  constructor(_app: express.Application, _db: DidWebDb, port: number) {
    this._app = _app
    this._db = _db
    this.port = port
  }

  static create(db: DidWebDb, port: number): DidWebServer {
    const app = express()

    app.use(cors())
    app.use(express.json())
    app.use((_req, res, next) => {
      res.locals.db = db
      next()
    })
    app.use('/', routes)

    const server = new DidWebServer(app, db, port)
    server._httpServer = app.listen(port)
    return server
  }

  async getByPath(didPath?: string): Promise<DidDocument | null> {
    if (!didPath) return null
    return this._db.get(didPath)
  }

  async getById(did?: string): Promise<DidDocument | null> {
    if (!did) return null
    const path = idToPath(did)
    return this.getByPath(path)
  }

  async put(didDoc: DidDocument) {
    await this._db.put(idToPath(didDoc.id), didDoc)
  }

  async delete(didOrDoc: string | DidDocument) {
    const did = typeof didOrDoc === 'string' ? didOrDoc : didOrDoc.id
    const path = idToPath(did)
    await this._db.del(path)
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this._httpServer) {
        this._httpServer.close(() => resolve())
      } else {
        resolve()
      }
    })
  }
}
