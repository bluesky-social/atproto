import assert from 'node:assert'
import * as undici from 'undici'
import * as nodemailer from 'nodemailer'
import { Redis } from 'ioredis'
import * as plc from '@did-plc/lib'
import {
  Fetch,
  isUnicastIp,
  loggedFetch,
  safeFetchWrap,
  unicastLookup,
} from '@atproto-labs/fetch-node'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import { JoseKey, OAuthVerifier } from '@atproto/oauth-provider'
import { BlobStore } from '@atproto/repo'
import {
  RateLimiter,
  RateLimiterCreator,
  RateLimiterOpts,
  createServiceAuthHeaders,
  createServiceJwt,
} from '@atproto/xrpc-server'

import { ServerConfig, ServerSecrets } from './config'
import { PdsOAuthProvider } from './oauth/provider'
import {
  AuthVerifier,
  createPublicKeyObject,
  createSecretKeyObject,
} from './auth-verifier'
import { fetchLogger } from './logger'
import { ServerMailer } from './mailer'
import { ModerationMailer } from './mailer/moderation'
import { AccountManager } from './account-manager'
import { Sequencer } from './sequencer'
import { BackgroundQueue } from './background'
import { DidSqliteCache } from './did-cache'
import { Crawlers } from './crawlers'
import { DiskBlobStore } from './disk-blobstore'
import { getRedisClient } from './redis'
import { ActorStore } from './actor-store'
import { LocalViewer, LocalViewerCreator } from './read-after-write/viewer'

export type AppContextOptions = {
  actorStore: ActorStore
  blobstore: (did: string) => BlobStore
  localViewer: LocalViewerCreator
  mailer: ServerMailer
  moderationMailer: ModerationMailer
  didCache: DidSqliteCache
  idResolver: IdResolver
  plcClient: plc.Client
  accountManager: AccountManager
  sequencer: Sequencer
  backgroundQueue: BackgroundQueue
  redisScratch?: Redis
  ratelimitCreator?: RateLimiterCreator
  crawlers: Crawlers
  appViewAgent?: AtpAgent
  moderationAgent?: AtpAgent
  reportingAgent?: AtpAgent
  entrywayAgent?: AtpAgent
  proxyAgent: undici.Dispatcher
  safeFetch: Fetch
  authProvider?: PdsOAuthProvider
  authVerifier: AuthVerifier
  plcRotationKey: crypto.Keypair
  cfg: ServerConfig
}

export class AppContext {
  public actorStore: ActorStore
  public blobstore: (did: string) => BlobStore
  public localViewer: LocalViewerCreator
  public mailer: ServerMailer
  public moderationMailer: ModerationMailer
  public didCache: DidSqliteCache
  public idResolver: IdResolver
  public plcClient: plc.Client
  public accountManager: AccountManager
  public sequencer: Sequencer
  public backgroundQueue: BackgroundQueue
  public redisScratch?: Redis
  public ratelimitCreator?: RateLimiterCreator
  public crawlers: Crawlers
  public appViewAgent: AtpAgent | undefined
  public moderationAgent: AtpAgent | undefined
  public reportingAgent: AtpAgent | undefined
  public entrywayAgent: AtpAgent | undefined
  public proxyAgent: undici.Dispatcher
  public safeFetch: Fetch
  public authVerifier: AuthVerifier
  public authProvider?: PdsOAuthProvider
  public plcRotationKey: crypto.Keypair
  public cfg: ServerConfig

  constructor(opts: AppContextOptions) {
    this.actorStore = opts.actorStore
    this.blobstore = opts.blobstore
    this.localViewer = opts.localViewer
    this.mailer = opts.mailer
    this.moderationMailer = opts.moderationMailer
    this.didCache = opts.didCache
    this.idResolver = opts.idResolver
    this.plcClient = opts.plcClient
    this.accountManager = opts.accountManager
    this.sequencer = opts.sequencer
    this.backgroundQueue = opts.backgroundQueue
    this.redisScratch = opts.redisScratch
    this.ratelimitCreator = opts.ratelimitCreator
    this.crawlers = opts.crawlers
    this.appViewAgent = opts.appViewAgent
    this.moderationAgent = opts.moderationAgent
    this.reportingAgent = opts.reportingAgent
    this.entrywayAgent = opts.entrywayAgent
    this.proxyAgent = opts.proxyAgent
    this.safeFetch = opts.safeFetch
    this.authVerifier = opts.authVerifier
    this.authProvider = opts.authProvider
    this.plcRotationKey = opts.plcRotationKey
    this.cfg = opts.cfg
  }

  static async fromConfig(
    cfg: ServerConfig,
    secrets: ServerSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<AppContext> {
    const blobstore =
      cfg.blobstore.provider === 's3'
        ? S3BlobStore.creator({
            bucket: cfg.blobstore.bucket,
            region: cfg.blobstore.region,
            endpoint: cfg.blobstore.endpoint,
            forcePathStyle: cfg.blobstore.forcePathStyle,
            credentials: cfg.blobstore.credentials,
            uploadTimeoutMs: cfg.blobstore.uploadTimeoutMs,
          })
        : DiskBlobStore.creator(
            cfg.blobstore.location,
            cfg.blobstore.tempLocation,
          )

    const mailTransport =
      cfg.email !== null
        ? nodemailer.createTransport(cfg.email.smtpUrl)
        : nodemailer.createTransport({ jsonTransport: true })

    const mailer = new ServerMailer(mailTransport, cfg)

    const modMailTransport =
      cfg.moderationEmail !== null
        ? nodemailer.createTransport(cfg.moderationEmail.smtpUrl)
        : nodemailer.createTransport({ jsonTransport: true })

    const moderationMailer = new ModerationMailer(modMailTransport, cfg)

    const didCache = new DidSqliteCache(
      cfg.db.didCacheDbLoc,
      cfg.identity.cacheStaleTTL,
      cfg.identity.cacheMaxTTL,
      cfg.db.disableWalAutoCheckpoint,
    )
    await didCache.migrateOrThrow()

    const idResolver = new IdResolver({
      plcUrl: cfg.identity.plcUrl,
      didCache,
      timeout: cfg.identity.resolverTimeout,
      backupNameservers: cfg.identity.handleBackupNameservers,
    })
    const plcClient = new plc.Client(cfg.identity.plcUrl)

    const backgroundQueue = new BackgroundQueue()
    const crawlers = new Crawlers(
      cfg.service.hostname,
      cfg.crawlers,
      backgroundQueue,
    )
    const sequencer = new Sequencer(
      cfg.db.sequencerDbLoc,
      crawlers,
      undefined,
      cfg.db.disableWalAutoCheckpoint,
    )
    const redisScratch = cfg.redis
      ? getRedisClient(cfg.redis.address, cfg.redis.password)
      : undefined

    let ratelimitCreator: RateLimiterCreator | undefined = undefined
    if (cfg.rateLimits.enabled) {
      const bypassSecret = cfg.rateLimits.bypassKey
      const bypassIps = cfg.rateLimits.bypassIps
      if (cfg.rateLimits.mode === 'redis') {
        if (!redisScratch) {
          throw new Error('Redis not set up for ratelimiting mode: `redis`')
        }
        ratelimitCreator = (opts: RateLimiterOpts) =>
          RateLimiter.redis(redisScratch, {
            bypassSecret,
            bypassIps,
            ...opts,
          })
      } else {
        ratelimitCreator = (opts: RateLimiterOpts) =>
          RateLimiter.memory({
            bypassSecret,
            bypassIps,
            ...opts,
          })
      }
    }

    const appViewAgent = cfg.bskyAppView
      ? new AtpAgent({ service: cfg.bskyAppView.url })
      : undefined
    const moderationAgent = cfg.modService
      ? new AtpAgent({ service: cfg.modService.url })
      : undefined
    const reportingAgent = cfg.reportService
      ? new AtpAgent({ service: cfg.reportService.url })
      : undefined
    const entrywayAgent = cfg.entryway
      ? new AtpAgent({ service: cfg.entryway.url })
      : undefined

    const jwtSecretKey = createSecretKeyObject(secrets.jwtSecret)
    const jwtPublicKey = cfg.entryway
      ? createPublicKeyObject(cfg.entryway.jwtPublicKeyHex)
      : null

    const accountManager = new AccountManager(
      backgroundQueue,
      cfg.db.accountDbLoc,
      jwtSecretKey,
      cfg.service.did,
      cfg.db.disableWalAutoCheckpoint,
    )
    await accountManager.migrateOrThrow()

    const plcRotationKey =
      secrets.plcRotationKey.provider === 'kms'
        ? await KmsKeypair.load({
            keyId: secrets.plcRotationKey.keyId,
          })
        : await crypto.Secp256k1Keypair.import(
            secrets.plcRotationKey.privateKeyHex,
          )

    const actorStore = new ActorStore(cfg.actorStore, {
      blobstore,
      backgroundQueue,
    })

    const localViewer = LocalViewer.creator({
      accountManager,
      appViewAgent,
      pdsHostname: cfg.service.hostname,
      appviewDid: cfg.bskyAppView?.did,
      appviewCdnUrlPattern: cfg.bskyAppView?.cdnUrlPattern,
    })

    // An agent for performing HTTP requests based on user provided URLs.
    const proxyAgentBase = new undici.Agent({
      allowH2: cfg.proxy.allowHTTP2, // This is experimental
      headersTimeout: cfg.proxy.headersTimeout,
      maxResponseSize: cfg.proxy.maxResponseSize,
      bodyTimeout: cfg.proxy.bodyTimeout,
      factory: cfg.proxy.disableSsrfProtection
        ? undefined
        : (origin, opts) => {
            const { protocol, hostname } =
              origin instanceof URL ? origin : new URL(origin)
            if (protocol !== 'https:') {
              throw new Error(`Forbidden protocol "${protocol}"`)
            }
            if (isUnicastIp(hostname) === false) {
              throw new Error('Hostname resolved to non-unicast address')
            }
            return new undici.Pool(origin, opts)
          },
      connect: {
        lookup: cfg.proxy.disableSsrfProtection ? undefined : unicastLookup,
      },
    })
    const proxyAgent =
      cfg.proxy.maxRetries > 0
        ? new undici.RetryAgent(proxyAgentBase, {
            statusCodes: [], // Only retry on socket errors
            methods: ['GET', 'HEAD'],
            maxRetries: cfg.proxy.maxRetries,
          })
        : proxyAgentBase

    // A fetch() function that protects against SSRF attacks, large responses &
    // known bad domains. This function can safely be used to fetch user
    // provided URLs (unless "disableSsrfProtection" is true, of course).
    const safeFetch = loggedFetch({
      fetch: safeFetchWrap({
        // Using globalThis.fetch allows safeFetchWrap to use keep-alive. See
        // unicastFetchWrap().
        fetch: globalThis.fetch,
        allowIpHost: false,
        responseMaxSize: cfg.fetch.maxResponseSize,
        ssrfProtection: !cfg.fetch.disableSsrfProtection,
      }),
      logRequest: ({ method, url }) => {
        fetchLogger.debug({ method, uri: url }, 'fetch')
      },
      logResponse: false,
      logError: false,
    })

    const authProvider = cfg.oauth.provider
      ? new PdsOAuthProvider({
          issuer: cfg.oauth.issuer,
          keyset: [
            // Note: OpenID compatibility would require an RS256 private key in this list
            await JoseKey.fromKeyLike(jwtSecretKey, undefined, 'HS256'),
          ],
          accountManager,
          actorStore,
          localViewer,
          redis: redisScratch,
          dpopSecret: secrets.dpopSecret,
          customization: cfg.oauth.provider.customization,
          safeFetch,
        })
      : undefined

    const oauthVerifier: OAuthVerifier =
      authProvider ?? // OAuthProvider extends OAuthVerifier
      new OAuthVerifier({
        issuer: cfg.oauth.issuer,
        keyset: [await JoseKey.fromKeyLike(jwtPublicKey!, undefined, 'ES256K')],
        dpopSecret: secrets.dpopSecret,
        redis: redisScratch,
      })

    const authVerifier = new AuthVerifier(
      accountManager,
      idResolver,
      oauthVerifier,
      {
        publicUrl: cfg.service.publicUrl,
        jwtKey: jwtPublicKey ?? jwtSecretKey,
        adminPass: secrets.adminPassword,
        dids: {
          pds: cfg.service.did,
          entryway: cfg.entryway?.did,
          modService: cfg.modService?.did,
        },
      },
    )

    return new AppContext({
      actorStore,
      blobstore,
      localViewer,
      mailer,
      moderationMailer,
      didCache,
      idResolver,
      plcClient,
      accountManager,
      sequencer,
      backgroundQueue,
      redisScratch,
      ratelimitCreator,
      crawlers,
      appViewAgent,
      moderationAgent,
      reportingAgent,
      entrywayAgent,
      proxyAgent,
      safeFetch,
      authVerifier,
      authProvider,
      plcRotationKey,
      cfg,
      ...(overrides ?? {}),
    })
  }

  async appviewAuthHeaders(did: string, lxm: string) {
    assert(this.cfg.bskyAppView)
    return this.serviceAuthHeaders(did, this.cfg.bskyAppView.did, lxm)
  }

  async serviceAuthHeaders(did: string, aud: string, lxm: string) {
    const keypair = await this.actorStore.keypair(did)
    return createServiceAuthHeaders({
      iss: did,
      aud,
      lxm,
      keypair,
    })
  }

  async serviceAuthJwt(did: string, aud: string, lxm: string) {
    const keypair = await this.actorStore.keypair(did)
    return createServiceJwt({
      iss: did,
      aud,
      lxm,
      keypair,
    })
  }
}

export default AppContext
