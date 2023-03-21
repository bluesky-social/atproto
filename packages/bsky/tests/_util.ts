import assert from 'assert'
import { AddressInfo } from 'net'
import ApiAgent from '@atproto/api'
import { defaultFetchHandler } from '@atproto/xrpc'
import * as crypto from '@atproto/crypto'
import * as pds from '@atproto/pds'
import { wait } from '@atproto/common'
import { PlcServer, Database as PlcDatabase } from '@did-plc/server'
import { AtUri } from '@atproto/uri'
import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import { BskyAppView, ServerConfig, Database } from '../src'
import { Main as FeedViewPost } from '../src/lexicon/types/app/bsky/feed/feedViewPost'
import DiskBlobStore from '../src/storage/disk-blobstore'
import MemoryBlobStore from '../src/storage/memory-blobstore'
import AppContext from '../src/context'

const ADMIN_PASSWORD = 'admin-pass'

export type CloseFn = () => Promise<void>
export type TestServerInfo = {
  ctx: AppContext
  bsky: BskyAppView
  url: string
  pds: pds.PDS
  pdsUrl: string
  plc: PlcServer
  plcUrl: string
  close: CloseFn
}

export type TestServerOpts = {
  migration?: string
}

export const runTestServer = async (
  params: Partial<ServerConfig> = {},
  opts: TestServerOpts = {},
): Promise<TestServerInfo> => {
  const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
  const dbPostgresSchema =
    params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA
  assert(dbPostgresUrl, 'Missing postgres url for tests')

  // run plc server

  const plcDb = PlcDatabase.mock()
  const plcServer = PlcServer.create({ db: plcDb })
  const plcListener = await plcServer.start()
  const plcPort = (plcListener.address() as AddressInfo).port
  const plcUrl = `http://localhost:${plcPort}`

  // run pds
  const recoveryKey = await crypto.Secp256k1Keypair.create({ exportable: true })

  const pdsCfg = new pds.ServerConfig({
    debugMode: true,
    version: '0.0.0',
    scheme: 'http',
    hostname: 'localhost',
    serverDid: 'did:fake:donotuse',
    recoveryKey: recoveryKey.did(),
    adminPassword: ADMIN_PASSWORD,
    inviteRequired: false,
    didPlcUrl: plcUrl,
    jwtSecret: 'jwt-secret',
    availableUserDomains: ['.test'],
    appUrlPasswordReset: 'app://forgot-password',
    emailNoReplyAddress: 'noreply@blueskyweb.xyz',
    publicUrl: 'https://pds.public.url',
    imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
    imgUriKey:
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
    dbPostgresUrl,
    maxSubscriptionBuffer: 200,
    repoBackfillLimitMs: 1000 * 60 * 60, // 1hr
  })

  const pdsBlobstore = new MemoryBlobStore()
  const pdsDb = pds.Database.memory()
  await pdsDb.migrateToLatestOrThrow()
  const repoSigningKey = await crypto.Secp256k1Keypair.create()
  const plcRotationKey = await crypto.Secp256k1Keypair.create()

  const pdsServer = pds.PDS.create({
    db: pdsDb,
    blobstore: pdsBlobstore,
    repoSigningKey,
    plcRotationKey,
    config: pdsCfg,
  })

  const pdsListener = await pdsServer.start()
  const pdsPort = (pdsListener.address() as AddressInfo).port

  // run app view

  const cfg = new ServerConfig({
    version: '0.0.0',
    didPlcUrl: plcUrl,
    publicUrl: 'https://bsky.public.url',
    imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
    imgUriKey:
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
    repoProvider: `ws://localhost:${pdsPort}`,
    ...params,
    dbPostgresUrl,
    dbPostgresSchema,
    // Each test suite gets its own lock id for the repo subscription
    repoSubLockId: uniqueLockId(),
  })

  const db = Database.postgres({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })

  if (opts.migration) {
    await db.migrateToOrThrow(opts.migration)
  } else {
    await db.migrateToLatestOrThrow()
  }

  const blobstore =
    cfg.blobstoreLocation !== undefined
      ? await DiskBlobStore.create(cfg.blobstoreLocation, cfg.blobstoreTmp)
      : new MemoryBlobStore()

  const bsky = BskyAppView.create({
    db,
    blobstore,
    config: cfg,
  })
  const bskyServer = await bsky.start()
  const bskyPort = (bskyServer.address() as AddressInfo).port

  // Map pds public url to its local url
  ApiAgent.configure({
    fetch: (httpUri, ...args) => {
      if (httpUri.startsWith(pdsServer.ctx.cfg.publicUrl)) {
        return defaultFetchHandler(
          httpUri.replace(
            pdsServer.ctx.cfg.publicUrl,
            `http://localhost:${pdsPort}`,
          ),
          ...args,
        )
      }
      return defaultFetchHandler(httpUri, ...args)
    },
  })

  return {
    ctx: bsky.ctx,
    bsky,
    url: `http://localhost:${bskyPort}`,
    pds: pdsServer,
    pdsUrl: `http://localhost:${pdsPort}`,
    plc: plcServer,
    plcUrl: `http://localhost:${plcPort}`,
    close: async () => {
      await bsky.destroy()
      await pdsServer.destroy()
      await plcServer.destroy()
    },
  }
}

// for pds
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
    if (str.match(/^\d+::bafy/)) {
      return constantKeysetCursor
    }
    if (str.match(/\/image\/[^/]+\/.+\/did:plc:[^/]+\/[^/]+@[\w]+$/)) {
      // Match image urls
      const match = str.match(
        /\/image\/([^/]+)\/.+\/(did:plc:[^/]+)\/([^/]+)@[\w]+$/,
      )
      if (!match) return str
      const [, sig, did, cid] = match
      return str
        .replace(sig, 'sig()')
        .replace(did, take(users, did))
        .replace(cid, take(cids, cid))
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

export const getOriginator = (item: FeedViewPost) => {
  if (!item.reason) {
    return item.post.author.did
  } else {
    return (item.reason.by as { [did: string]: string }).did
  }
}

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
export const constantKeysetCursor = '0000000000000::bafycid'

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
  limit = Infinity,
): Promise<T[]> => {
  const results: T[] = []
  let cursor
  do {
    const res = await fn(cursor)
    results.push(res)
    cursor = res.cursor
  } while (cursor && results.length < limit)
  return results
}

export const processAll = async (server: TestServerInfo, timeout = 5000) => {
  const { bsky, pds } = server
  const sub = bsky.sub
  const { db } = pds.ctx.db
  const start = Date.now()
  while (Date.now() - start < timeout) {
    await wait(50)
    const state = await sub.getState()
    const { lastSeq } = await db
      .selectFrom('repo_seq')
      .select(db.fn.max('repo_seq.seq').as('lastSeq'))
      .executeTakeFirstOrThrow()
    if (state.cursor === lastSeq) return
  }
  throw new Error(`Sequence was not processed within ${timeout}ms`)
}

const usedLockIds = new Set()
const uniqueLockId = () => {
  let lockId: number
  do {
    lockId = 1000 + Math.ceil(1000 * Math.random())
  } while (usedLockIds.has(lockId))
  usedLockIds.add(lockId)
  return lockId
}
