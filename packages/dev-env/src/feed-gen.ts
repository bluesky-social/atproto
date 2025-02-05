import events from 'node:events'
import http from 'node:http'
import * as plc from '@did-plc/lib'
import express from 'express'
import getPort from 'get-port'
import { Secp256k1Keypair } from '@atproto/crypto'
import { SkeletonHandler, createLexiconServer } from '@atproto/pds'
import { InvalidRequestError } from '@atproto/xrpc-server'

export class TestFeedGen {
  destroyed = false

  constructor(
    public port: number,
    public server: http.Server,
    public did: string,
  ) {}

  static async create(
    plcUrl: string,
    feeds: Record<string, SkeletonHandler>,
  ): Promise<TestFeedGen> {
    const port = await getPort()
    const did = await createFgDid(plcUrl, port)
    const app = express()
    const lexServer = createLexiconServer()

    lexServer.app.bsky.feed.getFeedSkeleton(async (args) => {
      const handler = feeds[args.params.feed]
      if (!handler) {
        throw new InvalidRequestError('unknown feed', 'UnknownFeed')
      }
      return handler(args)
    })

    lexServer.app.bsky.feed.describeFeedGenerator(async () => {
      return {
        encoding: 'application/json',
        body: {
          did,
          feeds: Object.keys(feeds).map((uri) => ({
            uri,
          })),
        },
      }
    })

    app.use(lexServer.xrpc.router)
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new TestFeedGen(port, server, did)
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.destroyed) return resolve()
      this.server.close((err) => {
        if (err) return reject(err)
        this.destroyed = true
        resolve()
      })
    })
  }
}

const createFgDid = async (plcUrl: string, port: number): Promise<string> => {
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
  return did
}
