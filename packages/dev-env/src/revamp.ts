import assert from 'assert'
import { AddressInfo } from 'net'
import { wait } from '@atproto/common'
import * as crypto from '@atproto/crypto'
import * as pds from '@atproto/pds'
import * as plc from '@did-plc/server'
import * as bsky from '@atproto/bsky'
import { AtUri } from '@atproto/uri'
import { AtpAgent } from '@atproto/api'
import { DidResolver } from '@atproto/did-resolver'
import { lexToJson } from '@atproto/lexicon'
import { CID } from 'multiformats/cid'
import * as uint8arrays from 'uint8arrays'
import {
  FeedViewPost,
  isThreadViewPost,
} from '@atproto/bsky/src/lexicon/types/app/bsky/feed/defs'
import { isViewRecord } from '@atproto/bsky/src/lexicon/types/app/bsky/embed/record'
import { defaultFetchHandler } from '@atproto/xrpc'
import { MessageDispatcher } from '@atproto/pds/src/event-stream/message-queue'
import getPort from 'get-port'

const ADMIN_PASSWORD = 'admin-pass'

export type CloseFn = () => Promise<void>

type ServerInfo = {
  port: number
  url: string
  close: CloseFn
}

export type PlcServerInfo = ServerInfo & {
  ctx: plc.AppContext
}

export type PdsServerInfo = ServerInfo & {
  ctx: pds.AppContext
}

export type BskyServerInfo = ServerInfo & {
  ctx: bsky.AppContext
}

export type TestServerInfo = {
  bsky: BskyServerInfo
  pds: PdsServerInfo
  plc: PlcServerInfo
  close: CloseFn
}

export type PlcConfig = {
  port?: number
  version?: string
}

export type PdsConfig = Partial<pds.ServerConfig> & {
  plcUrl: string
  migration?: string
}
export type BskyConfig = Partial<bsky.ServerConfig> & {
  plcUrl: string
  repoProvider: string
  dbPostgresUrl: string
  migration?: string
}

export type TestServerParams = {
  pds: PlcConfig
  plc: PdsConfig
  bsky?: BskyConfig
}

export const runTestServer = async (
  params: Partial<TestServerParams> = {},
): Promise<TestServerInfo> => {
  const plc = await runPlc({})
  const pds = await runPds({
    plcUrl: plc.url,
  })
  let bsky
  if (params.bsky) {
    const dbPostgresUrl =
      params.bsky.dbPostgresUrl || process.env.DB_POSTGRES_URL
    const dbPostgresSchema =
      params.bsky.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA
    assert(dbPostgresUrl, 'Missing postgres url for tests')
    bsky = await runBsky({
      plcUrl: plc.url,
      repoProvider: `ws://localhost:${pds.port}`,
      dbPostgresSchema,
      dbPostgresUrl,
    })
  }

  // // Map pds public url to its local url when resolving from plc
  // const origResolveDid = DidResolver.prototype.resolveDid
  // DidResolver.prototype.resolveDid = async function (did, options) {
  //   const result = await (origResolveDid.call(this, did, options) as ReturnType<
  //     typeof origResolveDid
  //   >)
  //   const service = result.didDocument?.service?.find(
  //     (svc) => svc.id === '#atproto_pds',
  //   )
  //   if (typeof service?.serviceEndpoint === 'string') {
  //     service.serviceEndpoint = service.serviceEndpoint.replace(
  //       pdsServer.ctx.cfg.publicUrl,
  //       `http://localhost:${pdsPort}`,
  //     )
  //   }
  //   return result
  // }

  // // Map pds public url and handles to pds local url
  // AtpAgent.configure({
  //   fetch: (httpUri, ...args) => {
  //     const url = new URL(httpUri)
  //     const pdsUrl = pdsServer.ctx.cfg.publicUrl
  //     const pdsHandleDomains = pdsServer.ctx.cfg.availableUserDomains
  //     if (
  //       url.origin === pdsUrl ||
  //       pdsHandleDomains.some((handleDomain) => url.host.endsWith(handleDomain))
  //     ) {
  //       url.protocol = 'http:'
  //       url.host = `localhost:${pdsPort}`
  //       return defaultFetchHandler(url.href, ...args)
  //     }
  //     return defaultFetchHandler(httpUri, ...args)
  //   },
  // })

  return {
    bsky,
    pds,
    plc,
    close: async () => {
      await bsky.close()
      await pds.close()
      await plc.close()
    },
  }
}

export const runPlc = async (cfg: PlcConfig) => {
  const db = plc.Database.mock()
  const server = plc.PlcServer.create({ db, ...cfg })
  const listener = await server.start()
  const port = (listener.address() as AddressInfo).port
  const url = `http://localhost:${port}`
  return {
    port,
    url,
    ctx: server.ctx,
    close: async () => {
      await server.destroy()
    },
  }
}

export const runPds = async (cfg: PdsConfig) => {
  const recoveryKey = await crypto.Secp256k1Keypair.create()

  const config = new pds.ServerConfig({
    debugMode: true,
    version: '0.0.0',
    scheme: 'http',
    hostname: 'localhost',
    serverDid: 'did:fake:donotuse',
    recoveryKey: recoveryKey.did(),
    adminPassword: ADMIN_PASSWORD,
    inviteRequired: false,
    userInviteInterval: null,
    didPlcUrl: cfg.plcUrl,
    jwtSecret: 'jwt-secret',
    availableUserDomains: ['.test'],
    appUrlPasswordReset: 'app://forgot-password',
    emailNoReplyAddress: 'noreply@blueskyweb.xyz',
    publicUrl: 'https://pds.public.url',
    imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
    imgUriKey:
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
    dbPostgresUrl: cfg.dbPostgresUrl,
    maxSubscriptionBuffer: 200,
    repoBackfillLimitMs: 1000 * 60 * 60, // 1hr
  })

  const blobstore = new pds.MemoryBlobStore()
  const db = pds.Database.memory()
  await db.migrateToLatestOrThrow()
  const repoSigningKey = await crypto.Secp256k1Keypair.create()
  const plcRotationKey = await crypto.Secp256k1Keypair.create()

  // Disable communication to app view within pds
  MessageDispatcher.prototype.send = async () => {}

  const server = pds.PDS.create({
    db,
    blobstore,
    repoSigningKey,
    plcRotationKey,
    config,
  })

  const listener = await server.start()
  const port = (listener.address() as AddressInfo).port
  const url = `http://localhost:${port}`
  return {
    port,
    url,
    ctx: server.ctx,
    close: async () => {
      await server.destroy()
    },
  }
}

export const runBsky = async (cfg: BskyConfig) => {
  const config = new bsky.ServerConfig({
    version: '0.0.0',
    didPlcUrl: cfg.plcUrl,
    publicUrl: 'https://bsky.public.url',
    imgUriSalt: '9dd04221f5755bce5f55f47464c27e1e',
    imgUriKey:
      'f23ecd142835025f42c3db2cf25dd813956c178392760256211f9d315f8ab4d8',
    ...cfg,
    // Each test suite gets its own lock id for the repo subscription
    repoSubLockId: uniqueLockId(),
  })

  const db = bsky.Database.postgres({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })

  if (cfg.migration) {
    await db.migrateToOrThrow(cfg.migration)
  } else {
    await db.migrateToLatestOrThrow()
  }

  const server = bsky.BskyAppView.create({ db, config })
  const listener = await server.start()
  const port = (listener.address() as AddressInfo).port
  const url = `http://localhost:${port}`
  return {
    port,
    url,
    ctx: server.ctx,
    close: async () => {
      await server.destroy()
    },
  }
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
