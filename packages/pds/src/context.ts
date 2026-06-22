import assert from 'node:assert'
import * as plc from '@did-plc/lib'
import express from 'express'
import { Redis } from 'ioredis'
import * as nodemailer from 'nodemailer'
import * as ui8 from 'uint8arrays'
import * as undici from 'undici'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { Client } from '@atproto/lex'
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
import { Fetch, safeFetchWrap } from '@atproto-labs/fetch-node'
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
import { ServerConfig, ServerSecrets } from './config/index.js'
import { Crawlers } from './crawlers.js'
import { DidSqliteCache } from './did-cache/index.js'
import { DiskBlobStore } from './disk-blobstore.js'
import { ImageUrlBuilder } from './image/image-url-builder.js'
import { fetchLogger, lexiconResolverLogger, oauthLogger } from './logger.js'
import { ServerMailer } from './mailer/index.js'
import { ModerationMailer } from './mailer/moderation.js'
import { buildProxyAgent } from './pipethrough.js'
import { LocalViewer, LocalViewerCreator } from './read-after-write/viewer.js'
import { getRedisClient } from './redis.js'
import { Sequencer } from './sequencer/index.js'

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
  moderationClient?: Client
  reportingClient?: Client
  entrywayClient?: Client
  entrywayAdminClient?: Client
  proxyAgent: undici.Dispatcher
  safeFetch: Fetch
  oauthProvider?: OAuthProvider
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
  public moderationClient: Client | undefined
  public reportingClient: Client | undefined
  public entrywayClient: Client | undefined
  public entrywayAdminClient: Client | undefined
  public proxyAgent: undici.Dispatcher
  public safeFetch: Fetch
  public authVerifier: AuthVerifier
  public oauthProvider?: OAuthProvider
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
    this.moderationClient = opts.moderationClient
    this.reportingClient = opts.reportingClient
    this.entrywayClient = opts.entrywayClient
    this.entrywayAdminClient = opts.entrywayAdminClient
    this.proxyAgent = opts.proxyAgent
    this.safeFetch = opts.safeFetch
    this.authVerifier = opts.authVerifier
    this.oauthProvider = opts.oauthProvider
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

    const mailer = new ServerMailer(mailTransport, cfg.email, cfg.branding)

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
    )
    const redisScratch = cfg.redis
      ? getRedisClient(cfg.redis.address, cfg.redis.password)
      : undefined

    const bskyAppView = cfg.bskyAppView
      ? new BskyAppView({
          ...cfg.bskyAppView,
          validateResponse: cfg.service.devMode,
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
          { service: cfg.entryway.url },
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
            { service: cfg.entryway.url },
            {
              headers: {
                authorization: basicAuthHeader(
                  'admin',
                  secrets.entrywayAdminToken,
                ),
              },
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
      secrets.plcRotationKey.provider === 'kms'
        ? await KmsKeypair.load({
            keyId: secrets.plcRotationKey.keyId,
          })
        : await crypto.Secp256k1Keypair.import(
            secrets.plcRotationKey.privateKeyHex,
          )

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

    const localViewer = LocalViewer.creator(
      accountManager,
      imageUrlBuilder,
      bskyAppView,
    )

    // An agent for performing HTTP requests based on user provided URLs.
    const proxyAgent = buildProxyAgent(cfg.proxy)

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

    const scopeRefGetter = entrywayClient
      ? new ScopeReferenceGetter(entrywayClient, redisScratch)
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
      moderationClient,
      reportingClient,
      entrywayClient,
      entrywayAdminClient,
      proxyAgent,
      safeFetch,
      authVerifier,
      oauthProvider,
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
