import { AddressInfo } from 'net'
import os from 'os'
import path from 'path'
import * as crypto from '@atproto/crypto'
import * as plc from '@did-plc/lib'
import { PlcServer, Database as PlcDatabase } from '@did-plc/server'
import { AtUri } from '@atproto/uri'
import { randomStr } from '@atproto/crypto'
import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import { PDS, ServerConfig, Database, MemoryBlobStore } from '../src/index'
import { FeedViewPost } from '../src/lexicon/types/app/bsky/feed/defs'
import DiskBlobStore from '../src/storage/disk-blobstore'
import AppContext from '../src/context'
import { HOUR } from '@atproto/common'
import { lexToJson } from '@atproto/lexicon'

const ADMIN_PASSWORD = 'admin-pass'
const MODERATOR_PASSWORD = 'moderator-pass'

export type CloseFn = () => Promise<void>
export type TestServerInfo = {
  url: string
  ctx: AppContext
  close: CloseFn
}

export type TestServerOpts = {
  migration?: string
}

export const runTestServer = async (
  params: Partial<ServerConfig> = {},
  opts: TestServerOpts = {},
): Promise<TestServerInfo> => {
  const repoSigningKey = await crypto.Secp256k1Keypair.create()
  const plcRotationKey = await crypto.Secp256k1Keypair.create()

  const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
  const dbPostgresSchema =
    params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA
  // run plc server

  let plcDb
  if (dbPostgresUrl !== undefined) {
    plcDb = PlcDatabase.postgres({
      url: dbPostgresUrl,
      schema: `plc_test_${dbPostgresSchema}`,
    })
    await plcDb.migrateToLatestOrThrow()
  } else {
    plcDb = PlcDatabase.mock()
  }

  const plcServer = PlcServer.create({ db: plcDb })
  const plcListener = await plcServer.start()
  const plcPort = (plcListener.address() as AddressInfo).port
  const plcUrl = `http://localhost:${plcPort}`

  const recoveryKey = (await crypto.Secp256k1Keypair.create()).did()

  const plcClient = new plc.Client(plcUrl)
  const serverDid = await plcClient.createDid({
    signingKey: repoSigningKey.did(),
    rotationKeys: [recoveryKey, plcRotationKey.did()],
    handle: 'localhost',
    pds: 'https://pds.public.url',
    signer: plcRotationKey,
  })

  const blobstoreLoc = path.join(os.tmpdir(), randomStr(5, 'base32'))

  const cfg = new ServerConfig({
    debugMode: true,
    version: '0.0.0',
    scheme: 'http',
    hostname: 'localhost',
    serverDid,
    recoveryKey,
    adminPassword: ADMIN_PASSWORD,
    moderatorPassword: MODERATOR_PASSWORD,
    inviteRequired: false,
    userInviteInterval: null,
    didPlcUrl: plcUrl,
    jwtSecret: 'jwt-secret',
    availableUserDomains: ['.test'],
    appUrlPasswordReset: 'app://forgot-password',
    emailNoReplyAddress: 'noreply@blueskyweb.xyz',
    publicUrl: 'https://pds.public.url',
    imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
    imgUriKey:
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
    dbPostgresUrl: process.env.DB_POSTGRES_URL,
    blobstoreLocation: `${blobstoreLoc}/blobs`,
    blobstoreTmp: `${blobstoreLoc}/tmp`,
    labelerDid: 'did:example:labeler',
    labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
    maxSubscriptionBuffer: 200,
    repoBackfillLimitMs: HOUR,
    ...params,
  })

  const db =
    cfg.dbPostgresUrl !== undefined
      ? Database.postgres({
          url: cfg.dbPostgresUrl,
          schema: cfg.dbPostgresSchema,
        })
      : Database.memory()

  // Separate migration db on postgres in case migration changes some
  // connection state that we need in the tests, e.g. "alter database ... set ..."
  const migrationDb =
    cfg.dbPostgresUrl !== undefined
      ? Database.postgres({
          url: cfg.dbPostgresUrl,
          schema: cfg.dbPostgresSchema,
        })
      : db
  if (opts.migration) {
    await migrationDb.migrateToOrThrow(opts.migration)
  } else {
    await migrationDb.migrateToLatestOrThrow()
  }
  if (migrationDb !== db) {
    await migrationDb.close()
  }

  const blobstore =
    cfg.blobstoreLocation !== undefined
      ? await DiskBlobStore.create(cfg.blobstoreLocation, cfg.blobstoreTmp)
      : new MemoryBlobStore()

  const pds = PDS.create({
    db,
    blobstore,
    repoSigningKey,
    plcRotationKey,
    config: cfg,
  })
  const pdsServer = await pds.start()
  const pdsPort = (pdsServer.address() as AddressInfo).port

  return {
    url: `http://localhost:${pdsPort}`,
    ctx: pds.ctx,
    close: async () => {
      await pds.destroy()
      await plcServer.destroy()
    },
  }
}

export const adminAuth = () => {
  return basicAuth('admin', ADMIN_PASSWORD)
}

export const moderatorAuth = () => {
  return basicAuth('admin', MODERATOR_PASSWORD)
}

const basicAuth = (username: string, password: string) => {
  return (
    'Basic ' +
    uint8arrays.toString(
      uint8arrays.fromString(`${username}:${password}`, 'utf8'),
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
  const toWalk = lexToJson(obj as any) // remove any blobrefs/cids
  return mapLeafValues(toWalk, (item) => {
    const asCid = CID.asCID(item)
    if (asCid !== null) {
      return take(cids, asCid.toString())
    }
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
    if (str.startsWith('pds-public-url-')) {
      return 'invite-code'
    }
    if (str.match(/^\d+::pds-public-url-/)) {
      return '0000000000000::invite-code'
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
