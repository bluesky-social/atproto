import os from 'node:os'
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
  const publicHostname = new URL(publicUrl).host
  const did = env.serviceDid ?? `did:web:${encodeURIComponent(publicHostname)}`
  const serviceCfg: ServerConfig['service'] = {
    port,
    hostname,
    publicUrl,
    did,
    isEntryway: env.isEntryway !== false, // defaults true
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

  let phoneVerificationCfg: ServerConfig['phoneVerification'] = {
    required: false,
  }
  if (env.phoneVerificationRequired) {
    const provider = env.phoneVerificationProvider
    let providerCfg: TwilioConfig | PlivoConfig
    if (provider === 'twilio') {
      assert(env.twilioAccountSid)
      assert(env.twilioServiceSid)
      providerCfg = {
        provider,
        accountSid: env.twilioAccountSid,
        serviceSid: env.twilioServiceSid,
      }
    } else if (provider === 'plivo') {
      assert(env.plivoAuthId)
      assert(env.plivoAppId)
      providerCfg = {
        provider,
        authId: env.plivoAuthId,
        appId: env.plivoAppId,
      }
    } else {
      throw new Error(`invalid phone verification provider: ${provider}`)
    }
    phoneVerificationCfg = {
      required: true,
      provider: providerCfg,
      accountsPerPhoneNumber: env.accountsPerPhoneNumber ?? 3,
      bypassPhoneNumber: env.bypassPhoneNumber,
    }
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

  assert(env.bskyAppViewUrl)
  assert(env.bskyAppViewDid)
  const bskyAppViewCfg: ServerConfig['bskyAppView'] = {
    url: env.bskyAppViewUrl,
    did: env.bskyAppViewDid,
    cdnUrlPattern: env.bskyAppViewCdnUrlPattern,
  }

  assert(env.modServiceUrl)
  assert(env.modServiceDid)
  const modServiceCfg: ServerConfig['modService'] = {
    url: env.modServiceUrl,
    did: env.modServiceDid,
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

  const courierHttpVersion = env.courierHttpVersion ?? '2'
  assert(courierHttpVersion === '1.1' || courierHttpVersion === '2')
  const activatorCfg: ServerConfig['activator'] = {
    courierUrl: env.courierUrl,
    courierHttpVersion,
    courierIgnoreBadTls: env.courierIgnoreBadTls,
    courierApiKey: env.courierApiKey,
    emailsPerDay: env.activatorEmailsPerDay,
  }

  const crawlersCfg: ServerConfig['crawlers'] = env.crawlers ?? []

  return {
    service: serviceCfg,
    db: dbCfg,
    blobstore: blobstoreCfg,
    identity: identityCfg,
    invites: invitesCfg,
    phoneVerification: phoneVerificationCfg,
    email: emailCfg,
    moderationEmail: moderationEmailCfg,
    subscription: subscriptionCfg,
    bskyAppView: bskyAppViewCfg,
    modService: modServiceCfg,
    redis: redisCfg,
    rateLimits: rateLimitsCfg,
    activator: activatorCfg,
    crawlers: crawlersCfg,
  }
}

export type ServerConfig = {
  service: ServiceConfig
  db: SqliteConfig | PostgresConfig
  blobstore: S3BlobstoreConfig | DiskBlobstoreConfig
  identity: IdentityConfig
  invites: InvitesConfig
  phoneVerification: PhoneVerificationConfig
  email: EmailConfig | null
  moderationEmail: EmailConfig | null
  subscription: SubscriptionConfig
  bskyAppView: BksyAppViewConfig
  modService: ModServiceConfig
  redis: RedisScratchConfig | null
  rateLimits: RateLimitsConfig
  activator: ActivatorConfig
  crawlers: string[]
}

export type ServiceConfig = {
  port: number
  hostname: string
  publicUrl: string
  did: string
  isEntryway: boolean
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

export type PhoneVerificationConfig =
  | {
      required: true
      provider: TwilioConfig | PlivoConfig
      accountsPerPhoneNumber: number
      bypassPhoneNumber?: string
    }
  | {
      required: false
    }

export type TwilioConfig = {
  provider: 'twilio'
  accountSid: string
  serviceSid: string
}

export type PlivoConfig = {
  provider: 'plivo'
  authId: string
  appId: string
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

export type ActivatorConfig = {
  courierUrl?: string
  courierHttpVersion?: '1.1' | '2'
  courierIgnoreBadTls?: boolean
  courierApiKey?: string
  emailsPerDay?: number
}

export type BksyAppViewConfig = {
  url: string
  did: string
  cdnUrlPattern?: string
}

export type ModServiceConfig = {
  url: string
  did: string
}
