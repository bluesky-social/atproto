import http from 'http'
import crypto from 'crypto'
// import { DIDDocument } from 'did-resolver'
// import { IonDid } from '@decentralized-identity/ion-sdk'
import EncoderModule from '@decentralized-identity/ion-sdk/dist/lib/Encoder.js'
import JsonCanonicalizerModule from '@decentralized-identity/ion-sdk/dist/lib/JsonCanonicalizer.js'
import MultihashModule from '@decentralized-identity/ion-sdk/dist/lib/Multihash.js'
import DocumentComposerModule from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/DocumentComposer.js'

// @ts-ignore module interop issue -prf
const Encoder = EncoderModule.default
// @ts-ignore module interop issue -prf
const JsonCanonicalizer = JsonCanonicalizerModule.default
// @ts-ignore module interop issue -prf
const Multihash = MultihashModule.default
// @ts-ignore module interop issue -prf
const DocumentComposer = DocumentComposerModule.default

const hashAlgorithmInMultihashCode = 18 // SHA256
const RESOLVE_ENDPOINT = '/1.0/identifiers'
const CHALLENGE_ENDPOINT = '/api/v1.0/proof-of-work-challenge'
const SOLUTION_ENDPOINT = '/api/v1.0/operations'

export async function createDidIonServer(
  port = 9999,
): Promise<MockDidIonServer> {
  const s = new MockDidIonServer(port)
  await s.whenReady
  return s
}

export class MockDidIonServer {
  _server: http.Server
  dids: Map<string, any> = new Map()
  whenReady: Promise<void>

  get resolveEndpoint() {
    return `http://localhost:${this.port}${RESOLVE_ENDPOINT}`
  }

  get challengeEndpoint() {
    return `http://localhost:${this.port}${CHALLENGE_ENDPOINT}`
  }

  get solutionEndpoint() {
    return `http://localhost:${this.port}${SOLUTION_ENDPOINT}`
  }

  constructor(public port: number) {
    this._server = http
      .createServer((req, res) => this._onRequest(req, res))
      .listen(port)
    this.whenReady = new Promise((resolve) => {
      this._server.on('listening', () => resolve())
    })
  }

  resolveDid(did: string, ops: any[]) {
    const doc = {}
    for (const op of ops) {
      DocumentComposer.applyPatches(doc, op.delta.patches)
    }
    return {
      didDocument: Object.assign({}, doc, {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: did,
      }),
      didDocumentMetadata: {}, // TODO
    }
  }

  async _onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      if (req.url?.startsWith(RESOLVE_ENDPOINT)) {
        const did = req.url.slice(RESOLVE_ENDPOINT.length + 1)
        const didShortForm = did.split(':').slice(0, 3).join(':')
        console.log('RESOLVE', didShortForm, did)
        const didDoc = this.dids.get(didShortForm)
        if (didDoc) {
          console.log('GOT', didDoc)
          res.writeHead(200, 'OK', {
            'Content-Type': 'application/json',
          })
          console.log('returning', this.resolveDid(didShortForm, didDoc.ops))
          res.write(JSON.stringify(this.resolveDid(didShortForm, didDoc.ops)))
          res.end()
        } else {
          res.writeHead(404, 'Not found')
          res.end()
        }
      } else if (req.url === CHALLENGE_ENDPOINT) {
        res.writeHead(200, 'OK', {
          'Content-Type': 'application/json',
        })
        res.write(
          JSON.stringify({
            challengeNonce: crypto.randomBytes(8).toString('hex'),
          }),
        )
        res.end()
      } else if (req.url === SOLUTION_ENDPOINT) {
        const op = await getJsonBody(req)
        if (op.type === 'create') {
          const did = createShortFormDid(op)
          this.dids.set(did, { ops: [op] })
        } else {
          console.log('TODO', op)
        }
        res.writeHead(200, 'OK')
        res.end()
      } else {
        res.writeHead(404, 'Not found')
        res.end()
      }
    } catch (e: any) {
      console.error(e)
      res.writeHead(500, 'Internal server error', {
        'Content-Type': 'application/json',
      })
      res.end(JSON.stringify({ error: e.toString() }))
    }
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this._server.close(() => resolve())
    })
  }
}

async function getJsonBody(req: http.IncomingMessage) {
  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk.toString('utf8'))
  }
  const str = chunks.join('')
  if (str.length) return JSON.parse(chunks.join(''))
  return undefined
}

function createShortFormDid(createRequest: any): string {
  const didUniqueSuffix = computeDidUniqueSuffix(createRequest.suffixData)
  return `did:ion:${didUniqueSuffix}`
}

function computeDidUniqueSuffix(suffixData: object): string {
  const canonicalizedStringBuffer =
    JsonCanonicalizer.canonicalizeAsBuffer(suffixData)
  const multihash = Multihash.hash(
    canonicalizedStringBuffer,
    hashAlgorithmInMultihashCode,
  )
  const encodedMultihash = Encoder.encode(multihash)
  return encodedMultihash
}
