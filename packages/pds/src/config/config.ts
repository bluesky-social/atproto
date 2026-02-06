import assert from 'node:assert'
import path from 'node:path'
import { DAY, HOUR, SECOND } from '@atproto/common'
import { BrandingInput, HcaptchaConfig } from '@atproto/oauth-provider'
import { ensureValidDid } from '@atproto/syntax'
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
    maxImportSize: env.maxImportSize,
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
      uploadTimeoutMs: env.blobstoreS3UploadTimeoutMs || 20000,
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
        bypassKey: env.rateLimitBypassKey,
        bypassIps: env.rateLimitBypassIps?.map((ipOrCidr) =>
          ipOrCidr.split('/')[0]?.trim(),
        ),
      }
    : { enabled: false }

  const crawlersCfg: ServerConfig['crawlers'] = env.crawlers ?? []

  const fetchCfg: ServerConfig['fetch'] = {
    disableSsrfProtection: env.disableSsrfProtection ?? env.devMode ?? false,
    maxResponseSize: env.fetchMaxResponseSize ?? 512 * 1024, // 512kb
  }

  const proxyCfg: ServerConfig['proxy'] = {
    disableSsrfProtection: env.disableSsrfProtection ?? env.devMode ?? false,
    allowHTTP2: env.proxyAllowHTTP2 ?? false,
    headersTimeout: env.proxyHeadersTimeout ?? 10e3,
    bodyTimeout: env.proxyBodyTimeout ?? 30e3,
    maxResponseSize: env.proxyMaxResponseSize ?? 10 * 1024 * 1024, // 10mb
    maxRetries:
      env.proxyMaxRetries != null && env.proxyMaxRetries > 0
        ? env.proxyMaxRetries
        : 0,
    preferCompressed: env.proxyPreferCompressed ?? false,
  }

  const oauthCfg: ServerConfig['oauth'] = entrywayCfg
    ? {
        issuer: entrywayCfg.url,
        provider: undefined,
      }
    : {
        issuer: serviceCfg.publicUrl,
        provider: {
          hcaptcha:
            env.hcaptchaSiteKey &&
            env.hcaptchaSecretKey &&
            env.hcaptchaTokenSalt
              ? {
                  siteKey: env.hcaptchaSiteKey,
                  secretKey: env.hcaptchaSecretKey,
                  tokenSalt: env.hcaptchaTokenSalt,
                }
              : undefined,
          branding: {
            name: env.serviceName ?? `${hostname} PDS`,
            logo: env.logoUrl,
            colors: {
              light: env.lightColor,
              dark: env.darkColor,
              primary: env.primaryColor,
              primaryContrast: env.primaryColorContrast,
              primaryHue: env.primaryColorHue,
              error: env.errorColor,
              errorContrast: env.errorColorContrast,
              errorHue: env.errorColorHue,
              success: env.successColor,
              successContrast: env.successColorContrast,
              successHue: env.successColorHue,
              warning: env.warningColor,
              warningContrast: env.warningColorContrast,
              warningHue: env.warningColorHue,
            },
            links: [
              {
                title: { en: 'Home', fr: 'Accueil' },
                href: env.homeUrl,
                rel: 'canonical' as const, // Prevents login page from being indexed
              },
              {
                title: { en: 'Terms of Service' },
                href: env.termsOfServiceUrl,
                rel: 'terms-of-service' as const,
              },
              {
                title: { en: 'Privacy Policy' },
                href: env.privacyPolicyUrl,
                rel: 'privacy-policy' as const,
              },
              {
                title: { en: 'Support' },
                href: env.supportUrl,
                rel: 'help' as const,
              },
            ].filter(
              <T extends { href?: string }>(f: T): f is T & { href: string } =>
                f.href != null && f.href !== '',
            ),
          },
          trustedClients: env.trustedOAuthClients,
        },
      }

  const lexiconCfg: LexiconResolverConfig = {}

  if (env.lexiconDidAuthority != null) {
    ensureValidDid(env.lexiconDidAuthority)
    lexiconCfg.didAuthority = env.lexiconDidAuthority
  }

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
    fetch: fetchCfg,
    lexicon: lexiconCfg,
    proxy: proxyCfg,
    oauth: oauthCfg,
    neuro: env.neuro || null,
    quicklogin: env.quickloginEnabled
      ? {
          enabled: true,
          apiBaseUrl: env.quickloginApiBaseUrl || 'https://lab.tagroot.io',
        }
      : null,
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
  fetch: FetchConfig
  proxy: ProxyConfig
  oauth: OAuthConfig
  lexicon: LexiconResolverConfig
  neuro: NeuroConfig | null
  quicklogin: QuickLoginConfig | null
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
  maxImportSize?: number
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
  uploadTimeoutMs?: number
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

export type FetchConfig = {
  disableSsrfProtection: boolean
  maxResponseSize: number
}

export type ProxyConfig = {
  disableSsrfProtection: boolean
  allowHTTP2: boolean
  headersTimeout: number
  bodyTimeout: number
  maxResponseSize: number
  maxRetries: number

  /**
   * When proxying requests that might get intercepted (for read-after-write) we
   * negotiate the encoding based on the client's preferences. We will however
   * use or own weights in order to be able to better control if the PDS will
   * need to perform content decoding. This settings allows to prefer compressed
   * content over uncompressed one.
   */
  preferCompressed: boolean
}

export type OAuthConfig = {
  issuer: string
  provider?: {
    hcaptcha?: HcaptchaConfig
    branding: BrandingInput
    trustedClients?: string[]
  }
}

export type LexiconResolverConfig = {
  didAuthority?: `did:${string}:${string}`
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

export type NeuroConfig = {
  enabled: boolean
  domain: string
  storageBackend: 'database' | 'redis'
  customUiPath?: string
  // RemoteLogin API configuration
  apiType?: 'quicklogin' | 'remotelogin' | 'both'
  responseMethod?: 'Callback' | 'Poll'
  callbackBaseUrl?: string
  pollIntervalMs?: number
  // Authentication for RemoteLogin API
  authMethod?: 'basic' | 'bearer' | 'mtls'
  basicUsername?: string
  basicPassword?: string
  bearerToken?: string
  // JWT verification
  verifyJwtSignature?: boolean
  petitionTimeoutSeconds?: number
}

export type QuickLoginConfig = {
  enabled: boolean
  apiBaseUrl: string
}
