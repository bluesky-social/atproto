import assert from 'node:assert'
import * as plc from '@did-plc/lib'
import type express from 'express'
import type { Redis } from 'ioredis'
import * as nodemailer from 'nodemailer'
import * as ui8 from 'uint8arrays'
import type * as undici from 'undici'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { Client } from '@atproto/lex-client'
import { parseCid } from '@atproto/lex-data'
import {
  AccessTokenMode,
  JoseKey,
  LexResolver,
  LexResolverError,
  OAuthProvider,
} from '@atproto/oauth-provider/provider'
import { OAuthVerifier } from '@atproto/oauth-provider/verifier'
import type { BlobStoreCreator } from '@atproto/repo'
import {
  createServiceAuthHeaders,
  createServiceJwt,
} from '@atproto/xrpc-server'
import { type Fetch, safeFetchWrap } from '@atproto-labs/fetch-node'
import { AccountManager } from './account-manager/account-manager.js'
import { OAuthStore } from './account-manager/oauth-store.js'
import { ScopeReferenceGetter } from './account-manager/scope-reference-getter.js'
import { ActorStore } from './actor-store/actor-store.js'
import { authPassthru, forwardedFor } from './api/proxy.js'
import {
  AuthVerifier,
  createPublicKeyObject,
  createSecretKeyObject,
} from './auth-verifier.js'
import { BackgroundQueue } from './background.js'
import { BskyAppView } from './bsky-app-view.js'
import {
  type ServerConfig,
  type ServerEnvironment,
  type ServerSecrets,
  envToCfg,
  envToSecrets,
  readEnv,
} from './config/index.js'
import { Crawlers } from './crawlers.js'
import { DidSqliteCache } from './did-cache/index.js'
import { DiskBlobStore } from './disk-blobstore.js'
import { events } from './events.js'
import { ImageUrlBuilder } from './image/image-url-builder.js'
import { fetchLogger, lexiconResolverLogger, oauthLogger } from './logger.js'
import { ServerMailer } from './mailer/index.js'
import { ModerationMailer } from './mailer/moderation.js'
import { buildProxyAgent } from './pipethrough.js'
import { ProxyLimiter, limiterFetch } from './proxy-limiter.js'
import { buildOAuthRateLimiterFactory } from './rate-limits.js'
import {
  LocalViewer,
  type LocalViewerCreator,
} from './read-after-write/viewer.js'
import { getRedisClient } from './redis.js'
import { FailOpenReplayStore } from './replay-store.js'
import { Sequencer } from './sequencer/index.js'
import { SpacesMigrationProgress } from './spaces-migration/progress.js'
import { SpacesMigrationPublisher } from './spaces-migration/publisher.js'
import {
  type GrantsSpaceAccess,
  neverGrantsSpaceAccess,
} from './spaces-migration/scope.js'
import { SpacesMigrationSweep } from './spaces-migration/sweep.js'

export type AppContextOptions = {
  actorStore: ActorStore
  blobstore: BlobStoreCreator
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
  crawlers: Crawlers
  bskyAppView?: BskyAppView
  moderationClient?: Client
  reportingClient?: Client
  entrywayClient?: Client
  entrywayAdminClient?: Client
  proxyAgent: undici.Dispatcher
  appViewProxyAgent?: undici.Dispatcher
  safeFetch: Fetch
  oauthProvider?: OAuthProvider
  authVerifier: AuthVerifier
  plcRotationKey: crypto.Keypair
  cfg: ServerConfig
  /** Whether a scope asks for space access. Defaults to never. */
  grantsSpaceAccess?: GrantsSpaceAccess
}

export type SpacesMigrationWorkers = {
  progress: SpacesMigrationProgress
  publisher: SpacesMigrationPublisher
  sweep: SpacesMigrationSweep
}

export class AppContext implements AsyncDisposable {
  public actorStore: ActorStore
  public blobstore: BlobStoreCreator
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
  public crawlers: Crawlers
  public bskyAppView?: BskyAppView
  public moderationClient: Client | undefined
  public reportingClient: Client | undefined
  public entrywayClient: Client | undefined
  public entrywayAdminClient: Client | undefined
  public proxyAgent: undici.Dispatcher
  public appViewProxyAgent: undici.Dispatcher | undefined
  public safeFetch: Fetch
  public authVerifier: AuthVerifier
  public oauthProvider?: OAuthProvider
  public plcRotationKey: crypto.Keypair
  public cfg: ServerConfig
  public spacesMigration: SpacesMigrationWorkers
  public grantsSpaceAccess: GrantsSpaceAccess

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
    this.crawlers = opts.crawlers
    this.bskyAppView = opts.bskyAppView
    this.moderationClient = opts.moderationClient
    this.reportingClient = opts.reportingClient
    this.entrywayClient = opts.entrywayClient
    this.entrywayAdminClient = opts.entrywayAdminClient
    this.proxyAgent = opts.proxyAgent
    this.appViewProxyAgent = opts.appViewProxyAgent
    this.safeFetch = opts.safeFetch
    this.authVerifier = opts.authVerifier
    this.oauthProvider = opts.oauthProvider
    this.plcRotationKey = opts.plcRotationKey
    this.cfg = opts.cfg
    this.grantsSpaceAccess = opts.grantsSpaceAccess ?? neverGrantsSpaceAccess

    // Built here rather than in fromConfig: the publisher needs the context
    const progress = new SpacesMigrationProgress(this.accountManager.db)
    this.spacesMigration = {
      progress,
      publisher: new SpacesMigrationPublisher(this, progress),
      sweep: new SpacesMigrationSweep(this, progress),
    }
  }

  static async fromEnv(
    env: ServerEnvironment = readEnv(),
    overrides?: Partial<AppContextOptions>,
  ): Promise<AppContext> {
    const cfg = envToCfg(env)
    const secrets = envToSecrets(env)
    return AppContext.fromConfig(cfg, secrets, overrides)
  }

  static async fromConfig(
    cfg: ServerConfig,
    secrets: ServerSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<AppContext> {
    // @TODO Implement using an AsyncDisposableStack

    const blobstore: BlobStoreCreator =
      overrides?.blobstore ??
      (cfg.blobstore.provider === 's3'
        ? S3BlobStore.creator({
            bucket: cfg.blobstore.bucket,
            region: cfg.blobstore.region,
            endpoint: cfg.blobstore.endpoint,
            forcePathStyle: cfg.blobstore.forcePathStyle,
            credentials: cfg.blobstore.credentials,
            uploadTimeoutMs: cfg.blobstore.uploadTimeoutMs,
            requestTimeoutMs: cfg.blobstore.requestTimeoutMs,
          })
        : DiskBlobStore.creator(
            cfg.blobstore.location,
            cfg.blobstore.tempLocation,
          ))

    const mailTransport =
      cfg.email !== null
        ? nodemailer.createTransport(cfg.email.smtpUrl)
        : nodemailer.createTransport({ jsonTransport: true })

    const mailer = new ServerMailer(
      mailTransport,
      cfg.email,
      cfg.branding,
      cfg.oauth.issuer,
    )

    const modMailTransport =
      cfg.moderationEmail !== null
        ? nodemailer.createTransport(cfg.moderationEmail.smtpUrl)
        : nodemailer.createTransport({ jsonTransport: true })

    const moderationMailer = new ModerationMailer(modMailTransport, cfg)

    /**
     * A fetch() function that protects against SSRF attacks, large responses &
     * known bad domains. This function can safely be used to fetch user
     * provided URLs (unless "disableSsrfProtection" is true, of course).
     *
     * @note **DO NOT** wrap `safeFetch` with any logging or other transforms as
     * this might prevent the use of explicit `redirect: "follow"` init from
     * working. See {@link safeFetchWrap}.
     */
    const safeFetch = safeFetchWrap({
      allowIpHost: false,
      allowImplicitRedirect: false,
      responseMaxSize: cfg.fetch.maxResponseSize,
      ssrfProtection: !cfg.fetch.disableSsrfProtection,

      fetch: function (input, init) {
        const method =
          init?.method ?? (input instanceof Request ? input.method : 'GET')
        const uri = input instanceof Request ? input.url : String(input)

        fetchLogger.info({ method, uri }, 'fetch')

        return globalThis.fetch.call(this, input, init)
      },
    })

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
      fetch: safeFetch,
    })
    const plcClient = new plc.Client(cfg.identity.plcUrl)

    const backgroundQueue = new BackgroundQueue(undefined, { concurrency: 5 })
    const crawlers = new Crawlers(
      backgroundQueue,
      cfg.service.hostname,
      cfg.crawlers,
    )
    const sequencer = new Sequencer(
      cfg.db.sequencerDbLoc,
      crawlers,
      undefined,
      cfg.db.disableWalAutoCheckpoint,
      cfg.db.synchronousFull,
    )
    const redisScratch = cfg.redis
      ? getRedisClient(cfg.redis.address, cfg.redis.password)
      : undefined
    // Without Redis the OAuth provider and verifier check replays in memory.
    const replayStore = redisScratch
      ? new FailOpenReplayStore(redisScratch)
      : undefined

    // One limiter for every request this PDS sends to the AppView: those it
    // proxies (appViewProxyAgent, below) and those its own handlers make
    // (bskyAppView.client). Counting only the first kind would leave the
    // second free to add to a surge the limit is there to hold back.
    const appViewLimiter =
      cfg.bskyAppView &&
      (cfg.bskyAppView.maxRequestsPerSecond > 0 ||
        cfg.bskyAppView.maxConcurrentRequests > 0)
        ? new ProxyLimiter(
            {
              maxRequestsPerSecond: cfg.bskyAppView.maxRequestsPerSecond,
              maxConcurrentRequests: cfg.bskyAppView.maxConcurrentRequests,
              maxQueuedRequests: cfg.bskyAppView.maxQueuedRequests,
              maxQueueMs: cfg.bskyAppView.maxQueueMs,
            },
            {
              granted: (waitMs) => events.appViewRequestGranted({ waitMs }),
              rejected: (reason) => events.appViewRequestRejected({ reason }),
            },
          )
        : undefined

    const bskyAppView = cfg.bskyAppView
      ? new BskyAppView({
          ...cfg.bskyAppView,
          validateResponse: cfg.service.devMode,
          fetch: appViewLimiter && limiterFetch(appViewLimiter),
        })
      : undefined

    const moderationClient = cfg.modService
      ? new Client(
          { service: cfg.modService.url },
          {
            // Trust internal services to send us well-formed responses
            strictResponseProcessing: false,
            validateResponse: cfg.service.devMode,
          },
        )
      : undefined
    const reportingClient = cfg.reportService
      ? new Client(
          { service: cfg.reportService.url },
          {
            // Trust internal services to send us well-formed responses
            strictResponseProcessing: false,
            validateResponse: cfg.service.devMode,
          },
        )
      : undefined
    const entrywayClient = cfg.entryway
      ? new Client(
          { service: cfg.entryway.apiUrl },
          {
            // Trust internal services to send us well-formed responses
            strictResponseProcessing: false,
            validateResponse: cfg.service.devMode,
          },
        )
      : undefined
    const entrywayAdminClient =
      cfg.entryway && secrets.entrywayAdminToken
        ? new Client(
            {
              service: cfg.entryway.apiUrl,
              headers: {
                authorization: basicAuthHeader(
                  'admin',
                  secrets.entrywayAdminToken,
                ),
              },
            },
            {
              // Trust internal services to send us well-formed responses
              strictResponseProcessing: false,
              validateResponse: cfg.service.devMode,
            },
          )
        : undefined

    const jwtSecretKey = createSecretKeyObject(secrets.jwtSecret)
    const jwtPublicKey = cfg.entryway
      ? createPublicKeyObject(cfg.entryway.jwtPublicKeyHex)
      : null

    const imageUrlBuilder = new ImageUrlBuilder(
      cfg.service.hostname,
      bskyAppView,
    )

    const actorStore = new ActorStore(cfg.actorStore, {
      blobstore,
      backgroundQueue,
    })

    const plcRotationKey =
      overrides?.plcRotationKey ??
      (secrets.plcRotationKey?.provider === 'kms'
        ? await KmsKeypair.load({
            keyId: secrets.plcRotationKey.keyId,
          })
        : secrets.plcRotationKey?.provider === 'memory'
          ? await crypto.Secp256k1Keypair.import(
              secrets.plcRotationKey.privateKeyHex,
            )
          : undefined)

    if (!plcRotationKey) {
      throw new Error('Must configure plc rotation key')
    }

    const accountManager = new AccountManager(
      cfg,
      actorStore,
      idResolver,
      jwtSecretKey,
      mailer,
      sequencer,
      plcClient,
      plcRotationKey,
    )
    await accountManager.migrateOrThrow()

    // @TODO Use this lexResolver instance to implement validation of records
    // created with the "validate" option. Before doing so, ensure that 1) a
    // didCache is provided, and 2) that nsid->lexicon are cached.
    const lexResolver = new LexResolver({
      fetch: safeFetch,
      didCache: undefined, // @TODO provide a dedicated cache
      plcDirectoryUrl: cfg.identity.plcUrl,
      hooks: {
        // @NOTE Lexicons hosted by this PDS are read straight from the
        // actor store. Fetching them over the network would require this
        // server to reach its own public endpoint, which is not
        // guaranteed to work (SSRF protection, missing NAT hairpin,
        // internal reverse proxies, ...).
        onFetch: async ({ uri, did, nsid, signal }) => {
          const account = await accountManager.getAccount(did, {
            includeDeactivated: true,
            includeTakenDown: true,
          })

          signal?.throwIfAborted()

          // Mirror what com.atproto.sync.getRecord would answer to an
          // unauthenticated requester
          if (account?.takedownRef) {
            throw new LexResolverError(nsid, `Repo is not available: ${did}`)
          }

          // Not hosted here: fall back to the network resolution
          if (!account || account.deactivatedAt) return undefined

          const record = await actorStore.read(account.did, (store) => {
            return store.record.getRecord(uri, null)
          })

          if (!record || record.takedownRef != null) {
            throw new LexResolverError(
              nsid,
              `Lexicon record not found at ${uri}`,
            )
          }

          return {
            cid: parseCid(record.cid),
            record: record.value,
          }
        },
        onFetchResult({ uri, cid, source }) {
          lexiconResolverLogger.info(
            { uri: uri.toString(), cid: cid.toString(), source },
            'Fetched lexicon',
          )
        },
        onFetchError({ err, uri }) {
          lexiconResolverLogger.error(
            { uri: uri.toString(), err },
            'Lexicon fetch error',
          )
        },
        onResolveAuthority: ({ nsid }) => {
          lexiconResolverLogger.debug(
            { nsid: nsid.toString() },
            'Resolving lexicon DID authority',
          )
          // Override the lexicon did resolution to point to a custom PDS
          return cfg.lexicon.didAuthority
        },
        onResolveAuthorityResult({ nsid, did, source }) {
          lexiconResolverLogger.info(
            { nsid: nsid.toString(), did, source },
            'Resolved lexicon DID',
          )
        },
        onResolveAuthorityError({ nsid, err }) {
          lexiconResolverLogger.error(
            { nsid: nsid.toString(), err },
            'Lexicon DID resolution error',
          )
        },
      },
    })

    const localViewer = LocalViewer.creator(
      accountManager,
      imageUrlBuilder,
      bskyAppView,
    )

    // An agent for performing HTTP requests based on user provided URLs.
    const proxyAgent = buildProxyAgent(cfg.proxy)
    // The operator sets the AppView's URL, so unlike a DID document's service
    // endpoint, it is allowed to resolve to a private address.
    //
    // Only this agent is limited. The other one serves whatever service a
    // user names in `atproto-proxy`: a shared cap there would let one user's
    // slow service hold every slot and starve all other proxied services.
    const appViewProxyAgent = cfg.bskyAppView
      ? buildProxyAgent(
          { ...cfg.proxy, disableSsrfProtection: true },
          appViewLimiter,
        )
      : undefined

    const oauthProvider = cfg.oauth.provider
      ? new OAuthProvider({
          issuer: cfg.oauth.issuer,
          keyset: [await JoseKey.fromKeyLike(jwtSecretKey, undefined, 'HS256')],
          store: new OAuthStore(
            accountManager,
            actorStore,
            imageUrlBuilder,
            backgroundQueue,
            mailer,
            sequencer,
            plcClient,
            plcRotationKey,
            cfg.service.publicUrl,
            cfg.identity.recoveryDidKey,
          ),
          replayStore,
          rateLimits: cfg.rateLimits.enabled
            ? {
                factory: buildOAuthRateLimiterFactory(redisScratch),
              }
            : undefined,
          dpopSecret: secrets.dpopSecret,
          inviteCodeRequired: cfg.invites.required,
          availableUserDomains: cfg.identity.serviceHandleDomains,
          hcaptcha: cfg.oauth.provider.hcaptcha,
          branding: cfg.oauth.provider.branding,
          // @NOTE Not operator-configurable on purpose: changing the email
          // address unconditionally clears `emailAuthFactorAt` (see
          // `account-manager/helpers/account.ts`), so the warning describes
          // what this implementation always does rather than a preference. This
          // is because updating email writes an unconfirmed email to the email
          // column, which means leaving email based 2FA enabled can result in
          // account lock-out.
          show2FaWarningOnEmailUpdate: true,
          allowHttp: cfg.service.devMode,
          plcDirectoryUrl: cfg.identity.plcUrl,
          fallbackNameservers: cfg.identity.handleBackupNameservers,
          handleCache: undefined, // Memory
          didCache: {
            // Map didCache to SimpleCache<Did, DidDocument>
            get: async (did) => {
              const res = await didCache.checkCache(did)
              // Expired entries are only ever refreshed by a resolution, so
              // report them as missing rather than serving them indefinitely.
              return res && !res.expired ? (res.doc as any) : undefined
            },
            set: async (did, doc) => {
              await didCache.cacheDid(did, doc as any)
            },
            del: async (did) => {
              await didCache.clearEntry(did)
            },
          },
          safeFetch,
          lexResolver,
          metadata: {
            protected_resources: [new URL(cfg.oauth.issuer).origin],
          },
          // If the PDS is both an authorization server & resource server (no
          // entryway), we can afford to check the token validity on every
          // request. This allows revoked tokens to be rejected immediately.
          // This also allows JWT to be shorter since some claims (notably the
          // "scope" claim) do not need to be included in the token.
          accessTokenMode: AccessTokenMode.stateful,

          getClientInfo(clientId) {
            return {
              isTrusted: cfg.oauth.provider?.trustedClients?.includes(clientId),
            }
          },
          onSignedUp({ account, input, clientId }) {
            events.accountCreated({
              source: 'oauth',
              did: account.did,
              clientId,
              invited: input.inviteCode != null,
              deactivated: false,
            })
          },
          onSignedIn({ account, clientId }) {
            events.signedIn({
              did: account.did,
              clientId,
            })
          },
          async onAuthorized({ account, client, parameters }) {
            events.oauthAuthorized({
              did: account.did,
              clientId: client.id,
              clientFirstParty: client.isFirstParty,
              clientTrusted: client.isTrusted,
              clientConfidential: client.isConfidential,
            })
            // Runs before the authorization response: it must never throw
            // or wait on PLC
            try {
              const { grantsSpaceAccess, spacesMigration } = getCtx()
              if (grantsSpaceAccess(parameters.scope ?? '')) {
                await spacesMigration.progress.bump(account.did)
                spacesMigration.publisher.wake()
              }
            } catch (err) {
              oauthLogger.error(
                { err, did: account.did },
                'failed to prioritize space authorization',
              )
            }
          },
          onTokenCreated({ account, client }) {
            events.sessionCreated({
              source: 'oauth',
              did: account.did,
              clientId: client.id,
            })
          },
          onTokenRefreshed({ account, client }) {
            events.sessionRefreshed({
              source: 'oauth',
              did: account.did,
              clientId: client.id,
            })
          },
        })
      : undefined

    const scopeRefGetter = entrywayClient
      ? new ScopeReferenceGetter(entrywayClient, redisScratch)
      : undefined

    const oauthVerifier: OAuthVerifier =
      oauthProvider ?? // OAuthProvider extends OAuthVerifier
      new OAuthVerifier({
        issuer: cfg.oauth.issuer,
        keyset: [await JoseKey.fromKeyLike(jwtPublicKey!, undefined, 'ES256K')],
        dpopSecret: secrets.dpopSecret,
        replayStore,
        onDecodeToken: async ({ payload, dpopProof }) => {
          // @TODO drop this once oauth provider no longer accepts DPoP proof with
          // query or fragment in "htu" claim.
          if (dpopProof?.htu.match(/[?#]/)) {
            oauthLogger.info(
              { htu: dpopProof.htu, client_id: payload.client_id },
              'DPoP proof "htu" contains query or fragment',
            )
          }

          if (scopeRefGetter) {
            payload.scope = await scopeRefGetter.dereference(payload.scope)
          }

          return payload
        },
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
        entrywayServiceAuth: cfg.entryway
          ? {
              didKey: crypto.formatDidKey(
                crypto.SECP256K1_JWT_ALG,
                ui8.fromString(cfg.entryway.jwtPublicKeyHex, 'hex'),
              ),
              required: cfg.entryway.requireServiceAuth,
            }
          : undefined,
      },
    )

    const getCtx = () => ctx

    const ctx = new AppContext({
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
      crawlers,
      bskyAppView,
      moderationClient,
      reportingClient,
      entrywayClient,
      entrywayAdminClient,
      proxyAgent,
      appViewProxyAgent,
      safeFetch,
      authVerifier,
      oauthProvider,
      plcRotationKey,
      cfg,
      ...(overrides ?? {}),
    })
    return ctx
  }

  async appviewAuthHeaders(did: string, lxm: string) {
    assert(this.bskyAppView)
    return this.serviceAuthHeaders(did, this.bskyAppView.did, lxm)
  }

  async entrywayAuthHeaders(req: express.Request, did: string, lxm: string) {
    assert(this.cfg.entryway)
    const headers = await this.serviceAuthHeaders(
      did,
      this.cfg.entryway.did,
      lxm,
    )
    return forwardedFor(req, headers)
  }

  entrywayPassthruHeaders(req: express.Request) {
    return forwardedFor(req, authPassthru(req))
  }

  /**
   * A {@link Client} for a service URL that was resolved from a DID document,
   * i.e. a URL the PDS does not control. Routes the request through
   * {@link safeFetch}, which restricts it to https origins that resolve to
   * unicast addresses, and caps the response size. Lexicon validation follows
   * the service's dev mode, as it does for the AppView client.
   *
   * Any call built from a DID document's service endpoint must use this.
   */
  safeClient(service: string | URL): Client {
    return new Client(
      { service, fetch: this.safeFetch },
      {
        validateRequest: this.cfg.service.devMode,
        validateResponse: this.cfg.service.devMode,
        strictResponseProcessing: this.cfg.service.devMode,
      },
    )
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

  async destroy(): Promise<void> {
    // @TODO Implement this using an AsyncDisposableStack when it becomes
    // widely available.
    try {
      await Promise.all([
        this.spacesMigration.publisher.destroy(),
        this.spacesMigration.sweep.destroy(),
      ])
      await this.backgroundQueue.destroy()
    } finally {
      try {
        await this.sequencer.destroy()
      } finally {
        try {
          await this.accountManager.close()
        } finally {
          try {
            // A Redis that doesn't answer QUIT (it times out) mustn't fail
            // shutdown: drop the connection instead.
            await this.redisScratch
              ?.quit()
              .catch(() => this.redisScratch?.disconnect())
          } finally {
            try {
              await this.proxyAgent.destroy()
            } finally {
              try {
                await this.appViewProxyAgent?.destroy()
              } finally {
                await this.blobstore[Symbol.asyncDispose]()
              }
            }
          }
        }
      }
    }
  }

  async [Symbol.asyncDispose]() {
    await this.destroy()
  }
}

const basicAuthHeader = (username: string, password: string) => {
  const encoded = ui8.toString(
    ui8.fromString(`${username}:${password}`, 'utf8'),
    'base64pad',
  )
  return `Basic ${encoded}`
}

export default AppContext
