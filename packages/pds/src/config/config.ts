import os from 'node:os'
import path from 'node:path'
import { DAY, HOUR, SECOND } from '@atproto/common'
import { ServerEnvironment } from './env'

// off-config but still from env:
// logging: LOG_LEVEL, LOG_SYSTEMS, LOG_ENABLED, LOG_DESTINATION

export const envToCfg = (env: ServerEnvironment): ServerConfig => {
  const port = env.port ?? 2583
  const hostname = env.hostname ?? 'localhost'
  const did = env.serviceDid ?? `did:web:${hostname}`
  const serviceCfg: ServerConfig['service'] = {
    port,
    hostname,
    did,
    version: env.version, // default?
    privacyPolicyUrl: env.privacyPolicyUrl,
    termsOfServiceUrl: env.termsOfServiceUrl,
  }

  let dbCfg: ServerConfig['db']
  if (env.dbSqliteLocation && env.dbPostgresUrl) {
    throw new Error('Cannot set both sqlite & postgres db env vars')
  }
  if (env.dbSqliteLocation) {
    dbCfg = {
      dialect: 'sqlite',
      location: env.dbSqliteLocation,
    }
  } else if (env.dbPostgresUrl) {
    dbCfg = {
      dialect: 'pg',
      url: env.dbPostgresUrl,
      migrationUrl: env.dbPostgresMigrationUrl || env.dbPostgresUrl,
      schema: env.dbPostgresSchema,
      pool: {
        idleTimeoutMs: env.dbPostgresPoolIdleTimeoutMs ?? 10000,
        maxUses: env.dbPostgresPoolMaxUses || Infinity,
        size: env.dbPostgresPoolSize ?? 10,
      },
    }
  } else {
    throw new Error('Must configure either sqlite or postgres db')
  }

  let blobstoreCfg: ServerConfig['blobstore']
  if (env.blobstoreS3Bucket && env.blobstoreDiskLocation) {
    throw new Error('Cannot set both S3 and disk blobstore env vars')
  }
  if (env.blobstoreS3Bucket) {
    blobstoreCfg = { provider: 's3', bucket: env.blobstoreS3Bucket }
  } else if (env.blobstoreDiskLocation) {
    blobstoreCfg = {
      provider: 'disk',
      location: env.blobstoreDiskLocation,
      tempLocation:
        env.blobstoreDiskTmpLocation || path.join(os.tmpdir(), 'pds/blobs'),
    }
  } else {
    throw new Error('Must configure either S3 or disk blobstore')
  }

  let handleDomains: string[]
  if (env.handleDomains && env.handleDomains.length > 0) {
    handleDomains = env.handleDomains
  } else {
    if (hostname === 'localhost') {
      handleDomains = ['.test']
    } else {
      handleDomains = [`.${hostname}`]
    }
  }
  const invalidDomain = handleDomains.find(
    (domain) => domain.length < 1 || !domain.startsWith('.'),
  )
  if (invalidDomain) {
    throw new Error(`Invalid handle domain: ${invalidDomain}`)
  }

  const identityCfg: ServerConfig['identity'] = {
    plcUrl: env.didPlcUrl || 'https://plc.bsky-sandbox.dev',
    cacheMaxTTL: env.didCacheMaxTTL || DAY,
    cacheStaleTTL: env.didCacheStaleTTL || HOUR,
    resolverTimeout: env.resolverTimeout || 3 * SECOND,
    recoveryDidKey: env.recoveryDidKey ?? null,
    handleDomains,
  }

  const invitesCfg: ServerConfig['invites'] = env.inviteRequired
    ? {
        required: true,
        interval: env.inviteInterval ?? null,
      }
    : {
        required: false,
      }

  let emailCfg: ServerConfig['email']
  if (!env.emailFromAddress && !env.emailSmtpUrl) {
    emailCfg = null
  } else {
    if (!env.emailFromAddress || !env.emailSmtpUrl) {
      throw new Error('Partial email config')
    }
    emailCfg = {
      smtpUrl: env.emailSmtpUrl,
      fromAddress: env.emailFromAddress,
    }
  }

  const subscriptionCfg: ServerConfig['subscription'] = {
    maxBuffer: env.maxSubscriptionBuffer ?? 500,
    repoBackfillLimitMs: env.repoBackfillLimitMs ?? DAY,
    sequencerLeaderLockId: env.sequencerLeaderLockId ?? 1100,
  }

  const bskyAppViewCfg: ServerConfig['bskyAppView'] = {
    endpoint: env.bskyAppViewEndpoint ?? 'https://api.bsky-sandbox.dev',
    did: env.bskyAppViewDid ?? 'did:plc:abc', // get real did
  }

  const crawlersCfg: ServerConfig['crawlers'] = env.crawlers ?? []

  return {
    service: serviceCfg,
    db: dbCfg,
    blobstore: blobstoreCfg,
    identity: identityCfg,
    invites: invitesCfg,
    email: emailCfg,
    subscription: subscriptionCfg,
    bskyAppView: bskyAppViewCfg,
    crawlers: crawlersCfg,
  }
}

export type ServerConfig = {
  service: ServiceConfig
  db: SqliteConfig | PostgresConfig
  blobstore: S3BlobstoreConfig | DiskBlobstoreConfig
  identity: IdentityConfig
  invites: InvitesConfig
  email: EmailConfig | null
  subscription: SubscriptionConfig
  bskyAppView: BksyAppViewConfig
  crawlers: string[]
}

export type ServiceConfig = {
  port: number
  hostname: string
  did: string
  version?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
}

export type SqliteConfig = {
  dialect: 'sqlite'
  location: string
}

export type PostgresPoolConfig = {
  size: number
  maxUses: number
  idleTimeoutMs: number
}

export type PostgresConfig = {
  dialect: 'pg'
  url: string
  migrationUrl: string
  pool: PostgresPoolConfig
  schema?: string
}

export type S3BlobstoreConfig = {
  provider: 's3'
  bucket: string
}

export type DiskBlobstoreConfig = {
  provider: 'disk'
  location: string
  tempLocation: string
}

export type IdentityConfig = {
  plcUrl: string
  resolverTimeout: number
  cacheStaleTTL: number
  cacheMaxTTL: number
  recoveryDidKey: string | null
  handleDomains: string[]
}

export type InvitesConfig =
  | {
      required: true
      interval: number | null
    }
  | {
      required: false
    }

export type EmailConfig = {
  smtpUrl: string
  fromAddress: string
}

export type SubscriptionConfig = {
  maxBuffer: number
  repoBackfillLimitMs: number
  sequencerLeaderLockId: number
}

export type BksyAppViewConfig = {
  endpoint: string
  did: string
}
