import http from 'http'
import { DIDDocument } from 'did-resolver'
import DidWebDb from './db'

const DOC_PATH = '/.well-known/did.json'

export class DidWebServer {
  _server: http.Server
  whenReady: Promise<void>

  constructor(private db: DidWebDb, public port: number) {
    this._server = http
      .createServer((req, res) => this._onRequest(req, res))
      .listen(port)
    this.whenReady = new Promise((resolve) => {
      this._server.on('listening', () => resolve())
    })
  }

  async _onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const got = await this.getByPath(req.url)
    if (got !== null) {
      res.writeHead(200, 'OK', {
        'Content-Type': 'application/did+ld+json',
      })
      res.write(JSON.stringify(got))
      res.end()
    } else {
      res.writeHead(404, 'Not found')
      res.end()
    }
  }

  _idToPath(id: string): string {
    const idp = id.split(':').slice(3)
    let path =
      idp.length > 0
        ? idp.map(decodeURIComponent).join('/') + '/did.json'
        : DOC_PATH

    if (!path.startsWith('/')) path = `/${path}`
    return path
  }

  async getByPath(didPath?: string): Promise<DIDDocument | null> {
    if (!didPath) return null
    return this.db.get(didPath)
  }

  async getById(did?: string): Promise<DIDDocument | null> {
    if (!did) return null
    const path = this._idToPath(did)
    return this.getByPath(path)
  }

  async put(didDoc: DIDDocument) {
    await this.db.put(this._idToPath(didDoc.id), didDoc)
  }

  async delete(didOrDoc: string | DIDDocument) {
    const did = typeof didOrDoc === 'string' ? didOrDoc : didOrDoc.id
    const path = this._idToPath(did)
    await this.db.del(path)
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this._server.close(() => resolve())
    })
  }
}
