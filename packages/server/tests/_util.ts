import { MemoryBlockstore } from '@atproto/repo'
import * as crypto from '@atproto/crypto'
import * as plc from '@atproto/plc'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import getPort from 'get-port'
import * as uint8arrays from 'uint8arrays'
import server, { ServerConfig, Database, App } from '../src/index'
import * as GetAuthorFeed from '../src/lexicon/types/app/bsky/getAuthorFeed'
import * as GetHomeFeed from '../src/lexicon/types/app/bsky/getHomeFeed'

const ADMIN_PASSWORD = 'admin-pass'

export type CloseFn = () => Promise<void>
export type TestServerInfo = {
  url: string
  app: App
  close: CloseFn
}

export const runTestServer = async (
  params: Partial<ServerConfig> = {},
): Promise<TestServerInfo> => {
  const pdsPort = await getPort()
  const keypair = await crypto.EcdsaKeypair.create()

  // run plc server
  const plcPort = await getPort()
  const plcUrl = `http://localhost:${plcPort}`
  const plcDb = await plc.Database.memory().createTables()
  const plcServer = plc.server(plcDb, plcPort)

  // setup server did
  const plcClient = new plc.PlcClient(plcUrl)
  const serverDid = await plcClient.createDid(
    keypair,
    keypair.did(),
    'pds.test',
    `http://localhost:${pdsPort}`,
  )

  const config = new ServerConfig({
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
    dbPostgresUrl: process.env.DB_POSTGRES_URL,
    ...params,
  })

  const db =
    config.dbPostgresUrl !== undefined
      ? await Database.postgres({
          url: config.dbPostgresUrl,
          schema: config.dbPostgresSchema,
        })
      : await Database.memory()

  await db.createTables()
  const serverBlockstore = new MemoryBlockstore()

  const { app, listener } = server(serverBlockstore, db, keypair, config)

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

// Swap out identifiers and dates with stable
// values for the purpose of snapshot testing
export const forSnapshot = (obj: unknown) => {
  const records = { [kTake]: 'record' }
  const collections = { [kTake]: 'collection' }
  const users = { [kTake]: 'user' }
  const cids = { [kTake]: 'cids' }
  const unknown = { [kTake]: 'unknown' }
  return mapLeafValues(obj, (item) => {
    if (typeof item !== 'string') {
      return item
    }
    const str = item.startsWith('did:plc:') ? `at://${item}` : item
    if (str.startsWith('at://')) {
      const uri = new AtUri(str)
      if (uri.rkey) {
        return take(records, str)
      }
      if (uri.collection) {
        return take(collections, str)
      }
      if (uri.hostname) {
        return take(users, str)
      }
      return take(unknown, str)
    }
    if (str.match(/^\d{4}-\d{2}-\d{2}T/)) {
      return constantDate
    }
    let isCid: boolean
    try {
      CID.parse(str)
      isCid = true
    } catch (_err) {
      isCid = false
    }
    if (isCid) {
      return take(cids, str)
    }
    return item
  })
}

// Feed testing utils

type FeedItem = GetAuthorFeed.AppBskyGetAuthorFeedFeedItem &
  GetHomeFeed.AppBskyGetHomeFeedFeedItem

export const getOriginator = (item: FeedItem) =>
  item.repostedBy ? item.repostedBy.did : item.author.did

// Useful for remapping ids in snapshot testing, to make snapshots deterministic.
// E.g. you may use this to map this:
//   [{ uri: 'did://rad'}, { uri: 'did://bad' }, { uri: 'did://rad'}]
// to this:
//   [{ uri: '0'}, { uri: '1' }, { uri: '0'}]
const kTake = Symbol('take')
export function take(obj, value: string): string
export function take(obj, value: string | undefined): string | undefined
export function take(
  obj: { [s: string]: number; [kTake]?: string },
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return
  }
  if (!(value in obj)) {
    obj[value] = Object.keys(obj).length
  }
  const kind = obj[kTake]
  return typeof kind === 'string'
    ? `${kind}(${obj[value]})`
    : String(obj[value])
}

export const constantDate = new Date(0).toISOString()

const mapLeafValues = (obj: unknown, fn: (val: unknown) => unknown) => {
  if (Array.isArray(obj)) {
    return obj.map((item) => mapLeafValues(item, fn))
  }
  if (obj && typeof obj === 'object') {
    return Object.entries(obj).reduce(
      (collect, [name, value]) =>
        Object.assign(collect, { [name]: mapLeafValues(value, fn) }),
      {},
    )
  }
  return fn(obj)
}

export const paginateAll = async <T extends { cursor?: string }>(
  fn: (cursor?: string) => Promise<T>,
): Promise<T[]> => {
  const results: T[] = []
  let cursor
  do {
    const res = await fn(cursor)
    results.push(res)
    cursor = res.cursor
  } while (cursor)
  return results
}
