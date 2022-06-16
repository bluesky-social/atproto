import http from 'http'
import { DIDDocument } from 'did-resolver'

const DOC_PATH = '/.well-known/did.json'

export class DidWebServer {
  _server: http.Server
  dids: Map<string, DIDDocument> = new Map()
  whenReady: Promise<void>

  constructor(public port: number) {
    this._server = http
      .createServer((req, res) => this._onRequest(req, res))
      .listen(port)
    this.whenReady = new Promise((resolve) => {
      this._server.on('listening', () => resolve())
    })
  }

  _onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.url && this.dids.has(req.url)) {
      res.writeHead(200, 'OK', {
        'Content-Type': 'application/did+ld+json',
      })
      res.write(JSON.stringify(this.dids.get(req.url)))
      res.end()
    } else {
      res.writeHead(404, 'Not found')
      res.end()
    }
  }

  _idToPath(id: string): string {
    const idp = id.split(':').slice(3)
    let path = DOC_PATH
    if (idp.length > 0) {
      path = idp.map(decodeURIComponent).join('/') + '/did.json'
    } else {
      path = DOC_PATH
    }
    if (!path.startsWith('/')) path = `/${path}`
    return path
  }

  put(didDoc: DIDDocument) {
    this.dids.set(this._idToPath(didDoc.id), didDoc)
  }

  delete(did: string | DIDDocument) {
    if (typeof did === 'string') {
      this.dids.delete(this._idToPath(did))
    } else {
      this.dids.delete(this._idToPath(did.id))
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this._server.close(() => resolve())
    })
  }
}
