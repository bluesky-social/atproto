import assert from 'node:assert'
import * as plc from '@did-plc/lib'
import express from 'express'
import { Redis } from 'ioredis'
import * as nodemailer from 'nodemailer'
import * as ui8 from 'uint8arrays'
import * as undici from 'undici'
import { AtpAgent } from '@atproto/api'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import {
  AccessTokenMode,
  JoseKey,
  LexResolver,
  OAuthProvider,
  OAuthVerifier,
} from '@atproto/oauth-provider'
import { BlobStore } from '@atproto/repo'
import {
  createServiceAuthHeaders,
  createServiceJwt,
} from '@atproto/xrpc-server'
import {
  Fetch,
  isUnicastIp,
  safeFetchWrap,
  unicastLookup,
} from '@atproto-labs/fetch-node'
import { AccountManager } from './account-manager/account-manager'
import { OAuthStore } from './account-manager/oauth-store'
import { ScopeReferenceGetter } from './account-manager/scope-reference-getter'
import { ActorStore } from './actor-store/actor-store'
import { QuickLoginSessionStore } from './api/io/trustanchor/quicklogin/store'
import { authPassthru, forwardedFor } from './api/proxy'
import {
  AuthVerifier,
  createPublicKeyObject,
  createSecretKeyObject,
} from './auth-verifier'
import { BackgroundQueue } from './background'
import { BskyAppView } from './bsky-app-view'
import { ServerConfig, ServerSecrets } from './config'
import { Crawlers } from './crawlers'
import { DidSqliteCache } from './did-cache'
import { DiskBlobStore } from './disk-blobstore'
import { ImageUrlBuilder } from './image/image-url-builder'
import { fetchLogger, lexiconResolverLogger, oauthLogger } from './logger'
import { ServerMailer } from './mailer'
import { ModerationMailer } from './mailer/moderation'
import { LocalViewer, LocalViewerCreator } from './read-after-write/viewer'
import { getRedisClient } from './redis'
import { Sequencer } from './sequencer'

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
  crawlers: Crawlers
  bskyAppView?: BskyAppView
  moderationAgent?: AtpAgent
  reportingAgent?: AtpAgent
  entrywayAgent?: AtpAgent
  entrywayAdminAgent?: AtpAgent
  proxyAgent: undici.Dispatcher
  safeFetch: Fetch
  oauthProvider?: OAuthProvider
  neuroAuthManager?: import('./account-manager/helpers/neuro-auth-manager').NeuroAuthManager
  neuroRemoteLoginManager?: import('./account-manager/helpers/neuro-remotelogin-manager').NeuroRemoteLoginManager
  quickloginStore: QuickLoginSessionStore
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
  public crawlers: Crawlers
  public bskyAppView?: BskyAppView
  public moderationAgent: AtpAgent | undefined
  public reportingAgent: AtpAgent | undefined
  public entrywayAgent: AtpAgent | undefined
  public entrywayAdminAgent: AtpAgent | undefined
  public proxyAgent: undici.Dispatcher
  public safeFetch: Fetch
  public authVerifier: AuthVerifier
  public oauthProvider?: OAuthProvider
  public neuroAuthManager?: import('./account-manager/helpers/neuro-auth-manager').NeuroAuthManager
  public quickloginStore: QuickLoginSessionStore
  public neuroRemoteLoginManager?: import('./account-manager/helpers/neuro-remotelogin-manager').NeuroRemoteLoginManager
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
    this.crawlers = opts.crawlers
    this.bskyAppView = opts.bskyAppView
    this.moderationAgent = opts.moderationAgent
    this.reportingAgent = opts.reportingAgent
    this.entrywayAgent = opts.entrywayAgent
    this.entrywayAdminAgent = opts.entrywayAdminAgent
    this.proxyAgent = opts.proxyAgent
    this.safeFetch = opts.safeFetch
    this.authVerifier = opts.authVerifier
    this.oauthProvider = opts.oauthProvider
    this.quickloginStore = opts.quickloginStore
    this.neuroAuthManager = opts.neuroAuthManager
    this.neuroRemoteLoginManager = opts.neuroRemoteLoginManager
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

    const bskyAppView = cfg.bskyAppView
      ? new BskyAppView(cfg.bskyAppView)
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
    let entrywayAdminAgent: AtpAgent | undefined
    if (cfg.entryway && secrets.entrywayAdminToken) {
      entrywayAdminAgent = new AtpAgent({ service: cfg.entryway.url })
      entrywayAdminAgent.api.setHeader(
        'authorization',
        basicAuthHeader('admin', secrets.entrywayAdminToken),
      )
    }

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

    const accountManager = new AccountManager(
      idResolver,
      jwtSecretKey,
      cfg.service.did,
      cfg.identity.serviceHandleDomains,
      cfg.db,
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

    const localViewer = LocalViewer.creator(
      accountManager,
      imageUrlBuilder,
      bskyAppView,
    )

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

      // @NOTE Since we are using NodeJS <= 20, unicastFetchWrap would normally
      // *not* be using a keep-alive agent if it we are providing a fetch
      // function that is different from `globalThis.fetch`. However, since the
      // fetch function below is indeed calling `globalThis.fetch` without
      // altering any argument, we can safely force the use of the keep-alive
      // agent. This would not be the case if we used "loggedFetch" as that
      // function does wrap the input & init arguments into a Request object,
      // which, on NodeJS<=20, results in init.dispatcher *not* being used.
      dangerouslyForceKeepAliveAgent: true,
      fetch: function (input, init) {
        const method =
          init?.method ?? (input instanceof Request ? input.method : 'GET')
        const uri = input instanceof Request ? input.url : String(input)

        fetchLogger.info({ method, uri }, 'fetch')

        return globalThis.fetch.call(this, input, init)
      },
    })

    // Create Neuro Auth Manager if configured
    let neuroAuthManager:
      | import('./account-manager/helpers/neuro-auth-manager').NeuroAuthManager
      | undefined
    let neuroRemoteLoginManager:
      | import('./account-manager/helpers/neuro-remotelogin-manager').NeuroRemoteLoginManager
      | undefined
    if (cfg.neuro?.enabled) {
      const { NeuroAuthManager } = await import(
        './account-manager/helpers/neuro-auth-manager'
      )
      neuroAuthManager = new NeuroAuthManager(
        {
          domain: cfg.neuro.domain,
          callbackBaseUrl: cfg.neuro.callbackBaseUrl || cfg.service.publicUrl,
          storageBackend: cfg.neuro.storageBackend,
        },
        cfg.neuro.storageBackend === 'database'
          ? accountManager.db
          : redisScratch,
        fetchLogger,
      )

      // Create RemoteLogin manager if configured
      if (cfg.neuro.apiType === 'remotelogin' || cfg.neuro.apiType === 'both') {
        const { NeuroRemoteLoginManager } = await import(
          './account-manager/helpers/neuro-remotelogin-manager'
        )
        neuroRemoteLoginManager = new NeuroRemoteLoginManager(
          {
            ...cfg.neuro,
            callbackBaseUrl: cfg.neuro.callbackBaseUrl || cfg.service.publicUrl,
          },
          fetchLogger,
        )
      }
    }

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
            neuroAuthManager,
            neuroRemoteLoginManager,
          ),
          redis: redisScratch,
          dpopSecret: secrets.dpopSecret,
          inviteCodeRequired: cfg.invites.required,
          availableUserDomains: cfg.identity.serviceHandleDomains,
          hcaptcha: cfg.oauth.provider.hcaptcha,
          branding: cfg.oauth.provider.branding,
          safeFetch,
          lexResolver: new LexResolver({
            fetch: safeFetch,
            plcDirectoryUrl: cfg.identity.plcUrl,
            hooks: {
              onResolveAuthority: ({ nsid }) => {
                lexiconResolverLogger.debug(
                  { nsid: nsid.toString() },
                  'Resolving lexicon DID authority',
                )
                // Override the lexicon did resolution to point to a custom PDS
                return cfg.lexicon.didAuthority
              },
              onResolveAuthorityResult({ nsid, did }) {
                lexiconResolverLogger.info(
                  { nsid: nsid.toString(), did },
                  'Resolved lexicon DID',
                )
              },
              onResolveAuthorityError({ nsid, err }) {
                lexiconResolverLogger.error(
                  { nsid: nsid.toString(), err },
                  'Lexicon DID resolution error',
                )
              },
              onFetchResult({ uri, cid }) {
                lexiconResolverLogger.info(
                  { uri: uri.toString(), cid: cid.toString() },
                  'Fetched lexicon',
                )
              },
              onFetchError({ err, uri }) {
                lexiconResolverLogger.error(
                  { uri: uri.toString(), err },
                  'Lexicon fetch error',
                )
              },
            },
          }),
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
        })
      : undefined

    const scopeRefGetter = entrywayAgent
      ? new ScopeReferenceGetter(entrywayAgent, redisScratch)
      : undefined

    const oauthVerifier: OAuthVerifier =
      oauthProvider ?? // OAuthProvider extends OAuthVerifier
      new OAuthVerifier({
        issuer: cfg.oauth.issuer,
        keyset: [await JoseKey.fromKeyLike(jwtPublicKey!, undefined, 'ES256K')],
        dpopSecret: secrets.dpopSecret,
        redis: redisScratch,
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
      },
    )

    // Create QuickLogin session store
    const quickloginStore = new QuickLoginSessionStore()

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
      crawlers,
      bskyAppView,
      moderationAgent,
      reportingAgent,
      entrywayAgent,
      entrywayAdminAgent,
      proxyAgent,
      safeFetch,
      authVerifier,
      oauthProvider,
      neuroAuthManager,
      neuroRemoteLoginManager,
      quickloginStore,
      plcRotationKey,
      cfg,
      ...(overrides ?? {}),
    })
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

const basicAuthHeader = (username: string, password: string) => {
  const encoded = ui8.toString(
    ui8.fromString(`${username}:${password}`, 'utf8'),
    'base64pad',
  )
  return `Basic ${encoded}`
}

export default AppContext
