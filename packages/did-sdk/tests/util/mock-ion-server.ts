import http from 'http'
import crypto from 'crypto'
import Encoder from '@decentralized-identity/ion-sdk/dist/lib/Encoder.js'
import JsonCanonicalizer from '@decentralized-identity/ion-sdk/dist/lib/JsonCanonicalizer.js'
import Multihash from '@decentralized-identity/ion-sdk/dist/lib/Multihash.js'
import MockOperationStore from '@decentralized-identity/sidetree/dist/tests/mocks/MockOperationStore.js'
import MockVersionManager from '@decentralized-identity/sidetree/dist/tests/mocks/MockVersionManager.js'
import OperationGenerator from '@decentralized-identity/sidetree/dist/tests/generators/OperationGenerator.js'
import DidWrapper from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/Did.js'
import DocumentComposer from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/DocumentComposer.js'
import OperationProcessor from '@decentralized-identity/sidetree/dist/lib/core/versions/latest/OperationProcessor.js'
import Resolver from '@decentralized-identity/sidetree/dist/lib/core/Resolver.js'

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

let anchorCounter = 0
export class MockDidIonServer {
  _server: http.Server
  resolver: any
  operationStore: any
  versionManager: any
  operationProcessor: any
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
    this.operationStore = new MockOperationStore()
    this.operationProcessor = new OperationProcessor()
    this.versionManager = new MockVersionManager()
    this.versionManager.getOperationProcessor = () => this.operationProcessor
    this.resolver = new Resolver(this.versionManager, this.operationStore)

    this._server = http
      .createServer((req, res) => this._onRequest(req, res))
      .listen(port)
    this.whenReady = new Promise((resolve) => {
      this._server.on('listening', () => resolve())
    })
  }

  async resolveDid(didShortForm: string, did: string) {
    const didState = await this.resolver.resolve(didShortForm)
    const published = false
    const response = DocumentComposer.transformToExternalDocument(
      didState,
      await DidWrapper.create(did, 'ion'),
      published,
    )
    // console.log('resolveDid()', did, didState, response)
    return response
  }

  async _onRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      if (req.url?.startsWith(RESOLVE_ENDPOINT)) {
        const did = req.url.slice(RESOLVE_ENDPOINT.length + 1)
        const didShortForm = did.split(':').slice(0, 3).join(':')
        // console.log('RESOLVE', didShortForm, did)
        try {
          const resBody = await this.resolveDid(didShortForm, did)
          res.writeHead(200, 'OK', {
            'Content-Type': 'application/json',
          })
          res.write(JSON.stringify(resBody))
          res.end()
        } catch {
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
        const did = createShortFormDid(op)
        const anchoredOp =
          OperationGenerator.createAnchoredOperationModelFromOperationModel(
            {
              didUniqueSuffix: did,
              type: op.type,
              operationBuffer: Buffer.from(JSON.stringify(op)),
            },
            anchorCounter,
            anchorCounter,
            anchorCounter,
          )
        anchorCounter++
        try {
          // console.log('inserting', op, anchoredOp)
          await this.operationStore.insertOrReplace([anchoredOp])
        } catch (e) {
          console.error('ION update failed', op, e)
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
  const chunks: any[] = []
  for await (const chunk of req) {
    chunks.push(chunk.toString('utf8'))
  }
  const str = chunks.join('')
  if (str.length) return JSON.parse(chunks.join(''))
  return undefined
}

function createShortFormDid(request: any): string {
  if (request.didSuffix) return `did:ion:${request.didSuffix}`
  const didUniqueSuffix = computeDidUniqueSuffix(request.suffixData)
  return `did:ion:${didUniqueSuffix}`
}

function computeDidUniqueSuffix(suffixData: any): string {
  const canonicalizedStringBuffer =
    JsonCanonicalizer.canonicalizeAsBuffer(suffixData)
  const multihash = Multihash.hash(
    canonicalizedStringBuffer,
    hashAlgorithmInMultihashCode,
  )
  const encodedMultihash = Encoder.encode(multihash)
  return encodedMultihash
}
