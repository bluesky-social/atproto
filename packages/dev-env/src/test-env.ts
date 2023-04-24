import assert from 'assert'
import { AddressInfo } from 'net'
import * as crypto from '@atproto/crypto'
import * as pds from '@atproto/pds'
import * as plc from '@did-plc/server'
import * as bsky from '@atproto/bsky'
import { AtpAgent } from '@atproto/api'
import { DidResolver } from '@atproto/did-resolver'
import { defaultFetchHandler } from '@atproto/xrpc'
import { MessageDispatcher } from '@atproto/pds/src/event-stream/message-queue'
import { RepoSubscription } from '@atproto/bsky/src/subscription/repo'

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
  sub: RepoSubscription
}

export type TestEnvInfo = {
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
  dbPostgresUrl: string
  dbPostgresSchema: string
  pds: Partial<pds.ServerConfig>
  bsky: Partial<bsky.ServerConfig>
}

export const runTestEnv = async (
  params: Partial<TestServerParams> = {},
): Promise<TestEnvInfo> => {
  const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
  assert(dbPostgresUrl, 'Missing postgres url for tests')
  const dbPostgresSchema =
    params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA

  const plc = await runPlc({})
  const pds = await runPds({
    dbPostgresUrl,
    dbPostgresSchema,
    plcUrl: plc.url,
  })
  const bsky = await runBsky({
    plcUrl: plc.url,
    repoProvider: `ws://localhost:${pds.port}`,
    dbPostgresSchema,
    dbPostgresUrl,
  })
  mockNetworkUtilities(pds)

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

export const runPlc = async (cfg: PlcConfig): Promise<PlcServerInfo> => {
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

export const runPds = async (cfg: PdsConfig): Promise<PdsServerInfo> => {
  const recoveryKey = await crypto.Secp256k1Keypair.create()

  const config = new pds.ServerConfig({
    debugMode: true,
    version: '0.0.0',
    scheme: 'http',
    hostname: 'localhost',
    serverDid: 'did:fake:donotuse',
    recoveryKey: recoveryKey.did(),
    adminPassword: 'admin-pass',
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
    labelerDid: 'did:example:labeler',
    labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
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

export const runBsky = async (cfg: BskyConfig): Promise<BskyServerInfo> => {
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
    adminPassword: 'admin-pass',
    labelerDid: 'did:example:labeler',
    labelerKeywords: { label_me: 'test-label', label_me_2: 'test-label-2' },
  })

  const db = bsky.Database.postgres({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })

  // Separate migration db in case migration changes some connection state that we need in the tests, e.g. "alter database ... set ..."
  const migrationDb = bsky.Database.postgres({
    url: cfg.dbPostgresUrl,
    schema: cfg.dbPostgresSchema,
  })
  if (cfg.migration) {
    await migrationDb.migrateToOrThrow(cfg.migration)
  } else {
    await migrationDb.migrateToLatestOrThrow()
  }
  await migrationDb.close()

  const server = bsky.BskyAppView.create({ db, config })
  const listener = await server.start()
  const port = (listener.address() as AddressInfo).port
  const url = `http://localhost:${port}`
  const sub = server.sub
  if (!sub) {
    throw new Error('No appview sub setup')
  }
  return {
    port,
    url,
    ctx: server.ctx,
    sub,
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

export const mockNetworkUtilities = (pds: PdsServerInfo) => {
  // Map pds public url to its local url when resolving from plc
  const origResolveDid = DidResolver.prototype.resolveDid
  DidResolver.prototype.resolveDid = async function (did) {
    const result = await (origResolveDid.call(this, did) as ReturnType<
      typeof origResolveDid
    >)
    const service = result?.service?.find((svc) => svc.id === '#atproto_pds')
    if (typeof service?.serviceEndpoint === 'string') {
      service.serviceEndpoint = service.serviceEndpoint.replace(
        pds.ctx.cfg.publicUrl,
        `http://localhost:${pds.port}`,
      )
    }
    return result
  }

  // Map pds public url and handles to pds local url
  AtpAgent.configure({
    fetch: (httpUri, ...args) => {
      const url = new URL(httpUri)
      const pdsUrl = pds.ctx.cfg.publicUrl
      const pdsHandleDomains = pds.ctx.cfg.availableUserDomains
      if (
        url.origin === pdsUrl ||
        pdsHandleDomains.some((handleDomain) => url.host.endsWith(handleDomain))
      ) {
        url.protocol = 'http:'
        url.host = `localhost:${pds.port}`
        return defaultFetchHandler(url.href, ...args)
      }
      return defaultFetchHandler(httpUri, ...args)
    },
  })
}
