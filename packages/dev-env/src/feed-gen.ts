import http from 'http'
import events from 'events'
import express from 'express'
import getPort from 'get-port'
import * as plc from '@did-plc/lib'
import { Secp256k1Keypair } from '@atproto/crypto'
import { Handler as SkeletonHandler } from '@atproto/pds/src/lexicon/types/app/bsky/feed/getFeedSkeleton'
import { createServer } from '@atproto/pds/src/lexicon'

export class TestFeedGen {
  constructor(
    public port: number,
    public server: http.Server,
    public did: string,
  ) {}

  static async create(
    plcUrl: string,
    fn: SkeletonHandler,
  ): Promise<TestFeedGen> {
    const port = await getPort()
    const did = await createFgDid(plcUrl, port)
    const app = express()
    const lexServer = createServer()
    lexServer.app.bsky.feed.getFeedSkeleton(fn)
    app.use(lexServer.xrpc.router)
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new TestFeedGen(port, server, did)
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) return reject(err)
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
