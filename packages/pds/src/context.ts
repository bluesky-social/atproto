import assert from 'node:assert'

import * as nodemailer from 'nodemailer'
import { Redis } from 'ioredis'
import * as plc from '@did-plc/lib'
import * as crypto from '@atproto/crypto'
import { Fetch } from '@atproto/fetch'
import { safeFetchWrap } from '@atproto/fetch-node'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import { NodeKeyset } from '@atproto/jwk-node'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { BlobStore } from '@atproto/repo'
import {
  AccessTokenType,
  DpopNonce,
  OAuthVerifier,
  OAuthProvider,
  ReplayStore,
} from '@atproto/oauth-provider'
import { OAuthReplayStoreRedis } from '@atproto/oauth-provider-replay-redis'
import { OAuthReplayStoreMemory } from '@atproto/oauth-provider-replay-memory'

import { ServerConfig, ServerSecrets } from './config'
import {
  AuthVerifier,
  createPublicKeyObject,
  createSecretKeyObject,
} from './auth-verifier'
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
import { OauthClientStore } from './oauth/oauth-client-store'
import { fetchLogger } from './logger'

export type AppContextOptions = {
  actorStore: ActorStore
  blobstore: (did: string) => BlobStore
  localViewer: LocalViewerCreator
  safeFetch: Fetch
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
  appViewAgent?: AtpAgent
  moderationAgent?: AtpAgent
  reportingAgent?: AtpAgent
  entrywayAgent?: AtpAgent
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
  public appViewAgent: AtpAgent | undefined
  public moderationAgent: AtpAgent | undefined
  public reportingAgent: AtpAgent | undefined
  public entrywayAgent: AtpAgent | undefined
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
    this.appViewAgent = opts.appViewAgent
    this.moderationAgent = opts.moderationAgent
    this.reportingAgent = opts.reportingAgent
    this.entrywayAgent = opts.entrywayAgent
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
    const accountManager = new AccountManager(
      cfg.db.accountDbLoc,
      jwtSecretKey,
      cfg.service.did,
      cfg.db.disableWalAutoCheckpoint,
    )
    await accountManager.migrateOrThrow()

    const jwtKey = cfg.entryway
      ? createPublicKeyObject(cfg.entryway.jwtPublicKeyHex)
      : jwtSecretKey

    const keyset = await NodeKeyset.fromImportables({
      // @TODO: load keys from config
      ['kid-1']:
        '-----BEGIN PRIVATE KEY-----\n' +
        'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg4D4H8/CFAVuKMgQD\n' +
        'BIK9m53AEUrCxQKrgtMNSTNV9A2hRANCAARAwyllCZOflLEQM0MaYujz7ITxqczZ\n' +
        '6Vxhj4urrdXUN3MEliQcc14ImTWHt7h7+xbxIXETLj0kTzctAxSbtwZf\n' +
        '-----END PRIVATE KEY-----\n',
    })

    // OAuthVerifier is capable of generating its own dpop nonce secret. Using a
    // pre-generated nonce is particularly useful to avoid invalid_nonce errors
    // when the server restarts or when more tha one instance are running. This
    // can also reduce the number of invalid_nonce errors when the PDS and
    // entryway are using the same dpop nonce secret.
    const dpopNonce = new DpopNonce(Buffer.from(secrets.dpopSecret, 'hex'))

    const replayStore: ReplayStore = redisScratch
      ? new OAuthReplayStoreRedis(redisScratch)
      : new OAuthReplayStoreMemory()

    // A Fetch function that protects against SSRF attacks, large responses &
    // known bad domains. This function can safely be used to fetch user
    // provided URLs.
    const safeFetch: Fetch = safeFetchWrap({
      ...cfg.safeFetch,
      fetch: async (request) => {
        fetchLogger.info({ method: request.method, uri: request.url }, 'fetch')
        return globalThis.fetch(request)
      },
    })

    const oauthProvider = cfg.oauth.enableProvider
      ? new OAuthProvider({
          issuer: cfg.oauth.issuer,
          keyset,
          dpopNonce,

          accountStore: accountManager,
          requestStore: accountManager,
          sessionStore: accountManager,
          tokenStore: accountManager,
          replayStore,
          clientStore: new OauthClientStore({ fetch: safeFetch }),

          // If the PDS is both an authorization server & resource server (no
          // entryway), there is no need to use JWTs as access tokens. Instead,
          // the PDS can use tokenId as access tokens. This allows the PDS to
          // always use up-to-date token data from the token store.
          accessTokenType: AccessTokenType.id,

          onTokenResponse: (tokenResponse, { account }) => {
            // ATPROTO extension: add the sub claim to the token response to allow
            // clients to resolve the PDS url (audience) using the did resolution
            // mechanism.
            tokenResponse['sub'] = account.sub
          },
        })
      : undefined

    /**
     * Using the oauthProvider as oauthVerifier allows clients to use the
     * same nonce when authenticating and making requests, avoiding
     * un-necessary "invalid_nonce" errors. It also allows the use of
     * AccessTokenType.id as access token type.
     */
    const oauthVerifier: OAuthVerifier =
      oauthProvider ??
      new OAuthVerifier({
        issuer: cfg.oauth.issuer,
        keyset,
        dpopNonce,
        replayStore,
      })

    const authVerifier = new AuthVerifier(accountManager, idResolver, {
      publicUrl: cfg.service.publicUrl,
      oauthVerifier,
      jwtKey,
      adminPass: secrets.adminPassword,
      dids: {
        pds: cfg.service.did,
        entryway: cfg.entryway?.did,
        modService: cfg.modService?.did,
      },
    })

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

    return new AppContext({
      actorStore,
      blobstore,
      localViewer,
      safeFetch,
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
      appViewAgent,
      moderationAgent,
      reportingAgent,
      entrywayAgent,
      authVerifier,
      oauthProvider,
      plcRotationKey,
      cfg,
      ...(overrides ?? {}),
    })
  }

  async appviewAuthHeaders(did: string) {
    assert(this.cfg.bskyAppView)
    return this.serviceAuthHeaders(did, this.cfg.bskyAppView.did)
  }

  async serviceAuthHeaders(did: string, aud: string) {
    const keypair = await this.actorStore.keypair(did)
    return createServiceAuthHeaders({
      iss: did,
      aud,
      keypair,
    })
  }
}

export default AppContext
