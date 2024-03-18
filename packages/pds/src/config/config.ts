import path from 'node:path'
import assert from 'node:assert'
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
    contactEmailAddress: env.contactEmailAddress,
    acceptingImports: env.acceptingImports ?? true,
    blobUploadLimit: env.blobUploadLimit ?? 5 * 1024 * 1024, // 5mb
    devMode: env.devMode ?? false,
  }

  const dbLoc = (name: string) => {
    return env.dataDirectory ? path.join(env.dataDirectory, name) : name
  }

  const disableWalAutoCheckpoint = env.disableWalAutoCheckpoint ?? false

  const dbCfg: ServerConfig['db'] = {
    accountDbLoc: env.accountDbLocation ?? dbLoc('account.sqlite'),
    sequencerDbLoc: env.sequencerDbLocation ?? dbLoc('sequencer.sqlite'),
    didCacheDbLoc: env.didCacheDbLocation ?? dbLoc('did_cache.sqlite'),
    disableWalAutoCheckpoint,
  }

  const actorStoreCfg: ServerConfig['actorStore'] = {
    directory: env.actorStoreDirectory ?? dbLoc('actors'),
    cacheSize: env.actorStoreCacheSize ?? 100,
    disableWalAutoCheckpoint,
  }

  let blobstoreCfg: ServerConfig['blobstore']
  if (env.blobstoreS3Bucket && env.blobstoreDiskLocation) {
    throw new Error('Cannot set both S3 and disk blobstore env vars')
  }
  if (env.blobstoreS3Bucket) {
    blobstoreCfg = {
      provider: 's3',
      bucket: env.blobstoreS3Bucket,
      region: env.blobstoreS3Region,
      endpoint: env.blobstoreS3Endpoint,
      forcePathStyle: env.blobstoreS3ForcePathStyle,
    }
    if (env.blobstoreS3AccessKeyId || env.blobstoreS3SecretAccessKey) {
      if (!env.blobstoreS3AccessKeyId || !env.blobstoreS3SecretAccessKey) {
        throw new Error(
          'Must specify both S3 access key id and secret access key blobstore env vars',
        )
      }
      blobstoreCfg.credentials = {
        accessKeyId: env.blobstoreS3AccessKeyId,
        secretAccessKey: env.blobstoreS3SecretAccessKey,
      }
    }
  } else if (env.blobstoreDiskLocation) {
    blobstoreCfg = {
      provider: 'disk',
      location: env.blobstoreDiskLocation,
      tempLocation: env.blobstoreDiskTmpLocation,
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

  let entrywayCfg: ServerConfig['entryway'] = null
  if (env.entrywayUrl) {
    assert(
      env.entrywayJwtVerifyKeyK256PublicKeyHex &&
        env.entrywayPlcRotationKey &&
        env.entrywayDid,
      'if entryway url is configured, must include all required entryway configuration',
    )
    entrywayCfg = {
      url: env.entrywayUrl,
      did: env.entrywayDid,
      jwtPublicKeyHex: env.entrywayJwtVerifyKeyK256PublicKeyHex,
      plcRotationKey: env.entrywayPlcRotationKey,
    }
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
  }

  let bskyAppViewCfg: ServerConfig['bskyAppView'] = null
  if (env.bskyAppViewUrl) {
    assert(
      env.bskyAppViewDid,
      'if bsky appview service url is configured, must configure its did as well.',
    )
    bskyAppViewCfg = {
      url: env.bskyAppViewUrl,
      did: env.bskyAppViewDid,
      cdnUrlPattern: env.bskyAppViewCdnUrlPattern,
    }
  }

  let modServiceCfg: ServerConfig['modService'] = null
  if (env.modServiceUrl) {
    assert(
      env.modServiceDid,
      'if mod service url is configured, must configure its did as well.',
    )
    modServiceCfg = {
      url: env.modServiceUrl,
      did: env.modServiceDid,
    }
  }

  let reportServiceCfg: ServerConfig['reportService'] = null
  if (env.reportServiceUrl) {
    assert(
      env.reportServiceDid,
      'if report service url is configured, must configure its did as well.',
    )
    reportServiceCfg = {
      url: env.reportServiceUrl,
      did: env.reportServiceDid,
    }
  }

  // if there's a mod service, default report service into it
  if (modServiceCfg && !reportServiceCfg) {
    reportServiceCfg = modServiceCfg
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
    actorStore: actorStoreCfg,
    blobstore: blobstoreCfg,
    identity: identityCfg,
    entryway: entrywayCfg,
    invites: invitesCfg,
    email: emailCfg,
    moderationEmail: moderationEmailCfg,
    subscription: subscriptionCfg,
    bskyAppView: bskyAppViewCfg,
    modService: modServiceCfg,
    reportService: reportServiceCfg,
    redis: redisCfg,
    rateLimits: rateLimitsCfg,
    crawlers: crawlersCfg,
  }
}

export type ServerConfig = {
  service: ServiceConfig
  db: DatabaseConfig
  actorStore: ActorStoreConfig
  blobstore: S3BlobstoreConfig | DiskBlobstoreConfig
  identity: IdentityConfig
  entryway: EntrywayConfig | null
  invites: InvitesConfig
  email: EmailConfig | null
  moderationEmail: EmailConfig | null
  subscription: SubscriptionConfig
  bskyAppView: BksyAppViewConfig | null
  modService: ModServiceConfig | null
  reportService: ReportServiceConfig | null
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
  acceptingImports: boolean
  blobUploadLimit: number
  contactEmailAddress?: string
  devMode: boolean
}

export type DatabaseConfig = {
  accountDbLoc: string
  sequencerDbLoc: string
  didCacheDbLoc: string
  disableWalAutoCheckpoint: boolean
}

export type ActorStoreConfig = {
  directory: string
  cacheSize: number
  disableWalAutoCheckpoint: boolean
}

export type S3BlobstoreConfig = {
  provider: 's3'
  bucket: string
  region?: string
  endpoint?: string
  forcePathStyle?: boolean
  credentials?: {
    accessKeyId: string
    secretAccessKey: string
  }
}

export type DiskBlobstoreConfig = {
  provider: 'disk'
  location: string
  tempLocation?: string
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

export type EntrywayConfig = {
  url: string
  did: string
  jwtPublicKeyHex: string
  plcRotationKey: string
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
  cdnUrlPattern?: string
}

export type ModServiceConfig = {
  url: string
  did: string
}

export type ReportServiceConfig = {
  url: string
  did: string
}
