import events from 'node:events'
import http from 'node:http'
import * as plc from '@did-plc/lib'
import getPort from 'get-port'
// eslint-disable-next-line import/default, import/no-named-as-default-member
import httpTerminator from 'http-terminator'
import { Secp256k1Keypair } from '@atproto/crypto'
import { SkeletonHandler, app } from '@atproto/pds'
import { AtUriString, DidString } from '@atproto/syntax'
import { InvalidRequestError, createServer } from '@atproto/xrpc-server'

export class TestFeedGen {
  private terminator: httpTerminator.HttpTerminator
  private terminatorPromise?: Promise<void>

  get destroyed() {
    return this.terminatorPromise != null
  }

  constructor(
    public port: number,
    public server: http.Server,
    public did: string,
  ) {
    this.terminator = httpTerminator.createHttpTerminator({ server })
  }

  static async create(
    plcUrl: string,
    feeds: Record<string, SkeletonHandler>,
  ): Promise<TestFeedGen> {
    const port = await getPort()
    const did = await createFgDid(plcUrl, port)
    const xrpcServer = createServer()

    xrpcServer.add(app.bsky.feed.getFeedSkeleton, async (args) => {
      const handler = feeds[args.params.feed]
      if (!handler) {
        throw new InvalidRequestError('unknown feed', 'UnknownFeed')
      }
      return handler(args)
    })

    xrpcServer.add(app.bsky.feed.describeFeedGenerator, async () => {
      return {
        encoding: 'application/json' as const,
        body: {
          did: did as DidString,
          feeds: (Object.keys(feeds) as AtUriString[]).map((uri) => ({
            uri,
          })),
        },
      }
    })

    const httpServer = xrpcServer.listen(port)
    await events.once(httpServer, 'listening')
    return new TestFeedGen(port, httpServer, did)
  }

  close(): Promise<void> {
    return (this.terminatorPromise ??= this.terminator.terminate())
  }

  async [Symbol.asyncDispose]() {
    await this.close()
  }
}

const createFgDid = async (
  plcUrl: string,
  port: number,
): Promise<DidString> => {
  const keypair = await Secp256k1Keypair.create()
  const plcClient = new plc.Client(plcUrl)
  const op = await plc.signOperation(
    {
      type: 'plc_operation',
      verificationMethods: {
        atproto: keypair.did(),
      },
      rotationKeys: [keypair.did()],
      alsoKnownAs: [],
      services: {
        bsky_fg: {
          type: 'BskyFeedGenerator',
          endpoint: `http://localhost:${port}`,
        },
      },
      prev: null,
    },
    keypair,
  )
  const did = await plc.didForCreateOp(op)
  await plcClient.sendOperation(did, op)
  return did as DidString
}
