import { MemoryBlockstore } from '@adxp/repo'
import * as crypto from '@adxp/crypto'
import * as plc from '@adxp/plc'
import { AdxUri } from '@adxp/uri'
import getPort from 'get-port'
import * as uint8arrays from 'uint8arrays'
import server, { ServerConfig, Database, App } from '../src/index'
import { AppBskyGetAuthorFeed, AppBskyGetHomeFeed } from '@adxp/api'

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

  const db = await Database.memory()
  await db.createTables()
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

// Swap out identifiers and dates with stable
// values for the purpose of snapshot testing
export const forSnapshot = (obj: unknown) => {
  const records = { [kTake]: 'record' }
  const collections = { [kTake]: 'collection' }
  const users = { [kTake]: 'user' }
  const unknown = { [kTake]: 'unknown' }
  return mapLeafValues(obj, (item) => {
    if (typeof item !== 'string') {
      return item
    }
    const str = item.startsWith('did:plc:') ? `adx://${item}` : item
    if (str.startsWith('adx://')) {
      const uri = new AdxUri(str)
      if (uri.recordKey) {
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
    return item
  })
}

// Feed testing utils

type FeedItem = AppBskyGetAuthorFeed.FeedItem & AppBskyGetHomeFeed.FeedItem

export const getCursors = (feed: FeedItem[]) => feed.map((item) => item.cursor)

export const getSortedCursors = (feed: FeedItem[]) =>
  getCursors(feed).sort((a, b) => tstamp(b) - tstamp(a))

export const getOriginator = (item: FeedItem) =>
  item.repostedBy ? item.repostedBy.did : item.author.did

const tstamp = (x: string) => new Date(x).getTime()

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
