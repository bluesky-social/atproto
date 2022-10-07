import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'
import * as plc from '@adxp/plc'
import getPort from 'get-port'
import * as uint8arrays from 'uint8arrays'

import server, { ServerConfig, Database, App } from '../src/index'
import { FeedItem as HomeFeedItem } from '@adxp/api/src/types/todo/social/getHomeFeed'
import { FeedItem as AuthorFeedItem } from '@adxp/api/src/types/todo/social/getAuthorFeed'
import { Record as PostRecord } from '@adxp/api/src/types/todo/social/post'

const USE_TEST_SERVER = true

const ADMIN_PASSWORD = 'admin-pass'

export type CloseFn = () => Promise<void>
export type TestServerInfo = {
  url: string
  app?: App
  close: CloseFn
}

export const runTestServer = async (
  params: Partial<ServerConfig> = {},
): Promise<TestServerInfo> => {
  if (!USE_TEST_SERVER) {
    return {
      url: 'http://localhost:2583',
      close: async () => {},
    }
  }
  const pdsPort = await getPort()
  const keypair = await crypto.EcdsaKeypair.create()

  // run plc server
  const plcPort = await getPort()
  const plcUrl = `http://localhost:${plcPort}`
  const plcDb = await plc.Database.memory()
  const plcServer = plc.server(plcDb, plcPort)

  // setup server did
  const plcClient = new plc.PlcClient(plcUrl)
  const serverDid = await plcClient.createDid(
    keypair,
    keypair.did(),
    'pds.test',
    `http://localhost:${pdsPort}`,
  )

  const db = await Database.memory()
  const serverBlockstore = new MemoryBlockstore()
  const { app, listener } = server(
    serverBlockstore,
    db,
    keypair,
    new ServerConfig({
      debugMode: true,
      scheme: 'http',
      hostname: 'localhost',
      port: pdsPort,
      serverDid,
      adminPassword: ADMIN_PASSWORD,
      inviteRequired: false,
      didPlcUrl: plcUrl,
      jwtSecret: 'jwt-secret',
      testNameRegistry: {},
      appUrlPasswordReset: 'app://forgot-password',
      emailNoReplyAddress: 'noreply@blueskyweb.xyz',
      ...params,
    }),
  )

  return {
    url: `http://localhost:${pdsPort}`,
    app,
    close: async () => {
      await Promise.all([
        db.close(),
        listener.close(),
        plcServer?.close(),
        plcDb?.close(),
      ])
    },
  }
}

export const adminAuth = () => {
  return (
    'Basic ' +
    uint8arrays.toString(
      uint8arrays.fromString('admin:' + ADMIN_PASSWORD, 'utf8'),
      'base64pad',
    )
  )
}

export function feedForSnapshot(feed: (HomeFeedItem & AuthorFeedItem)[]) {
  const authors = {}
  const posts = {}
  const likes = {}
  const reposts = {}
  const entities = {}
  return feed.map((item) => {
    item = { ...item }
    item.uri = take(posts, item.uri)
    item.cursor = constantDate
    item.indexedAt = constantDate
    item.author = { ...item.author }
    item.author.did = take(authors, item.author.did)
    if (item.repostedBy) {
      item.repostedBy = { ...item.repostedBy }
      item.repostedBy.did = take(authors, item.repostedBy.did)
    }
    if (item.myState) {
      item.myState = { ...item.myState }
      item.myState.like = take(likes, item.myState.like)
      item.myState.repost = take(reposts, item.myState.repost)
    }
    // @ts-ignore
    const record: PostRecord = { ...item.record }
    item.record = record
    record.createdAt = constantDate
    if (record.reply) {
      record.reply = { ...record.reply }
      record.reply.parent = take(posts, record.reply.parent)
      record.reply.root = take(posts, record.reply.root)
    }
    if (record.entities) {
      record.entities = record.entities.map((entity) => ({
        ...entity,
        value: take(entities, entity.value),
      }))
    }
    return item
  })
}

// Useful for remapping ids in snapshot testing, to make snapshots deterministic.
// E.g. you may use this to map this:
//   [{ uri: 'did://rad'}, { uri: 'did://bad' }, { uri: 'did://rad'}]
// to this:
//   [{ uri: '0'}, { uri: '1' }, { uri: '0'}]

export function take(obj, value: string): string
export function take(obj, value: string | undefined): string | undefined
export function take(
  obj: { [s: string]: number },
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return
  }
  if (!(value in obj)) {
    obj[value] = Object.keys(obj).length
  }
  return String(obj[value])
}

export const constantDate = new Date(0).toISOString()
