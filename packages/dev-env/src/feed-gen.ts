/* eslint-disable import/no-deprecated */

import events from 'node:events'
import http from 'node:http'
import * as plc from '@did-plc/lib'
import getPort from 'get-port'
import { Secp256k1Keypair } from '@atproto/crypto'
import { SkeletonHandler, app } from '@atproto/pds'
import { AtUriString, DidString } from '@atproto/syntax'
import { InvalidRequestError, createServer } from '@atproto/xrpc-server'

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
    const lexServer = createServer()

    lexServer.add(app.bsky.feed.getFeedSkeleton, async (args) => {
      const handler = feeds[args.params.feed]
      if (!handler) {
        throw new InvalidRequestError('unknown feed', 'UnknownFeed')
      }
      return handler(args)
    })

    lexServer.add(app.bsky.feed.describeFeedGenerator, async () => {
      return {
        encoding: 'application/json',
        body: {
          did: did as DidString,
          feeds: (Object.keys(feeds) as AtUriString[]).map((uri) => ({
            uri,
          })),
        },
      }
    })

    const httpServer = lexServer.listen(port)
    await events.once(httpServer, 'listening')
    return new TestFeedGen(port, httpServer, did)
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
