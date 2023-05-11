import events from 'events'
import http from 'http'
import express from 'express'
import getPort from 'get-port'
import { Handler as SkeletonHandler } from '../src/lexicon/types/app/bsky/feed/getFeedSkeleton'
import { runTestServer, TestServerInfo } from './_util'
import { createServer } from '../src/lexicon'
import { AtpAgent } from '@atproto/api'
import { SeedClient } from './seeds/client'
import basicSeed from './seeds/basic'

describe('feed generation', () => {
  let server: TestServerInfo
  let agent: AtpAgent
  let sc: SeedClient

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'feed_generation',
    })
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    await server.ctx.backgroundQueue.processAll()
  })

  afterAll(async () => {
    await server.close()
  })

  it('works', async () => {
    const gen = await SimpleFeedGenerator.create(async () => {
      const feed = [
        {
          post: sc.posts[sc.dids.alice][0].ref.uriStr,
        },
        {
          post: sc.posts[sc.dids.bob][0].ref.uriStr,
        },
      ]
      return {
        encoding: 'application/json',
        body: {
          feed,
        },
      }
      return {} as any
    })
  })
})

class SimpleFeedGenerator {
  constructor(public server: http.Server) {}

  static async create(fn: SkeletonHandler) {
    const app = express()
    const lexServer = createServer()
    lexServer.app.bsky.feed.getFeedSkeleton(fn)
    app.use(lexServer.xrpc.router)
    const port = await getPort()
    const server = app.listen(port)
    await events.once(server, 'listening')
    return new SimpleFeedGenerator(server)
  }

  destroy(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (err) return reject(err)
        resolve()
      })
    })
  }
}
