import os from 'node:os'
import path from 'node:path'
import { DAY, HOUR, SECOND } from '@atproto/common'
import { ServerEnvironment } from './env'

// off-config but still from env:
// logging: LOG_LEVEL, LOG_SYSTEMS, LOG_ENABLED, LOG_DESTINATION

export const envToCfg = (env: ServerEnvironment): ServerConfig => {
  const port = env.port ?? 2583
  const hostname = env.hostname ?? 'localhost'
  const publicUrl =
    hostname === 'localhost'
      ? `http://localhost:${port}`
      : `https://${hostname}`
  const did = env.serviceDid ?? `did:web:${hostname}`
  const serviceCfg: ServerConfig['service'] = {
    port,
    hostname,
    publicUrl,
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
      migrationUrl: env.dbPostgresMigrationUrl ?? env.dbPostgresUrl,
      schema: env.dbPostgresSchema,
      pool: {
        idleTimeoutMs: env.dbPostgresPoolIdleTimeoutMs ?? 10000,
        maxUses: env.dbPostgresPoolMaxUses ?? Infinity,
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
        env.blobstoreDiskTmpLocation ?? path.join(os.tmpdir(), 'pds/blobs'),
    }
  } else {
    throw new Error('Must configure either S3 or disk blobstore')
  }

  let serviceHandleDomains: string[]
  if (env.serviceHandleDomains && env.serviceHandleDomains.length > 0) {
    serviceHandleDomains = env.serviceHandleDomains
  } else {
    if (hostname === 'localhost') {
      serviceHandleDomains = ['.test']
    } else {
      serviceHandleDomains = [`.${hostname}`]
    }
  }
  const invalidDomain = serviceHandleDomains.find(
    (domain) => domain.length < 1 || !domain.startsWith('.'),
  )
  if (invalidDomain) {
    throw new Error(`Invalid handle domain: ${invalidDomain}`)
  }

  const identityCfg: ServerConfig['identity'] = {
    plcUrl: env.didPlcUrl ?? 'https://plc.directory',
    cacheMaxTTL: env.didCacheMaxTTL ?? DAY,
    cacheStaleTTL: env.didCacheStaleTTL ?? HOUR,
    resolverTimeout: env.resolverTimeout ?? 3 * SECOND,
    recoveryDidKey: env.recoveryDidKey ?? null,
    serviceHandleDomains,
    handleBackupNameservers: env.handleBackupNameservers,
    enableDidDocWithSession: !!env.enableDidDocWithSession,
  }

  // default to being required if left undefined
  const invitesCfg: ServerConfig['invites'] =
    env.inviteRequired === false
      ? {
          required: false,
        }
      : {
          required: true,
          interval: env.inviteInterval ?? null,
          epoch: env.inviteEpoch ?? 0,
        }

  let emailCfg: ServerConfig['email']
  if (!env.emailFromAddress && !env.emailSmtpUrl) {
    emailCfg = null
  } else {
    if (!env.emailFromAddress || !env.emailSmtpUrl) {
      throw new Error(
        'Partial email config, must set both emailFromAddress and emailSmtpUrl',
      )
    }
    emailCfg = {
      smtpUrl: env.emailSmtpUrl,
      fromAddress: env.emailFromAddress,
    }
  }

  let moderationEmailCfg: ServerConfig['moderationEmail']
  if (!env.moderationEmailAddress && !env.moderationEmailSmtpUrl) {
    moderationEmailCfg = null
  } else {
    if (!env.moderationEmailAddress || !env.moderationEmailSmtpUrl) {
      throw new Error(
        'Partial moderation email config, must set both emailFromAddress and emailSmtpUrl',
      )
    }
    moderationEmailCfg = {
      smtpUrl: env.moderationEmailSmtpUrl,
      fromAddress: env.moderationEmailAddress,
    }
  }

  const subscriptionCfg: ServerConfig['subscription'] = {
    maxBuffer: env.maxSubscriptionBuffer ?? 500,
    repoBackfillLimitMs: env.repoBackfillLimitMs ?? DAY,
    sequencerLeaderEnabled: env.sequencerLeaderEnabled ?? true,
    sequencerLeaderLockId: env.sequencerLeaderLockId ?? 1100,
  }

  if (!env.bskyAppViewUrl) {
    throw new Error('Must configure PDS_BSKY_APP_VIEW_URL')
  } else if (!env.bskyAppViewDid) {
    throw new Error('Must configure PDS_BSKY_APP_VIEW_DID')
  }
  const bskyAppViewCfg: ServerConfig['bskyAppView'] = {
    url: env.bskyAppViewUrl,
    did: env.bskyAppViewDid,
    proxyModeration: env.bskyAppViewModeration ?? false,
    cdnUrlPattern: env.bskyAppViewCdnUrlPattern,
  }

  const redisCfg: ServerConfig['redis'] = env.redisScratchAddress
    ? {
        address: env.redisScratchAddress,
        password: env.redisScratchPassword,
      }
    : null

  const rateLimitsCfg: ServerConfig['rateLimits'] = env.rateLimitsEnabled
    ? {
        enabled: true,
        mode: redisCfg !== null ? 'redis' : 'memory',
        bypassKey: env.rateLimitBypassKey,
        bypassIps: env.rateLimitBypassIps?.map((ipOrCidr) =>
          ipOrCidr.split('/')[0]?.trim(),
        ),
      }
    : { enabled: false }

  const crawlersCfg: ServerConfig['crawlers'] = env.crawlers ?? []

  return {
    service: serviceCfg,
    db: dbCfg,
    blobstore: blobstoreCfg,
    identity: identityCfg,
    invites: invitesCfg,
    email: emailCfg,
    moderationEmail: moderationEmailCfg,
    subscription: subscriptionCfg,
    bskyAppView: bskyAppViewCfg,
    redis: redisCfg,
    rateLimits: rateLimitsCfg,
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
  moderationEmail: EmailConfig | null
  subscription: SubscriptionConfig
  bskyAppView: BksyAppViewConfig
  redis: RedisScratchConfig | null
  rateLimits: RateLimitsConfig
  crawlers: string[]
}

export type ServiceConfig = {
  port: number
  hostname: string
  publicUrl: string
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
  serviceHandleDomains: string[]
  handleBackupNameservers?: string[]
  enableDidDocWithSession: boolean
}

export type InvitesConfig =
  | {
      required: true
      interval: number | null
      epoch: number
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
  sequencerLeaderEnabled: boolean
  sequencerLeaderLockId: number
}

export type RedisScratchConfig = {
  address: string
  password?: string
}

export type RateLimitsConfig =
  | {
      enabled: true
      mode: 'memory' | 'redis'
      bypassKey?: string
      bypassIps?: string[]
    }
  | { enabled: false }

export type BksyAppViewConfig = {
  url: string
  did: string
  proxyModeration: boolean
  cdnUrlPattern?: string
}
