import assert from 'node:assert'
import * as nodemailer from 'nodemailer'
import { Redis } from 'ioredis'
import * as plc from '@did-plc/lib'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { ServerConfig, ServerSecrets } from './config'
import {
  AuthVerifier,
  createPublicKeyObject,
  createSecretKeyObject,
} from './auth-verifier'
import { ServerMailer } from './mailer'
import { ModerationMailer } from './mailer/moderation'
import { BlobStore } from '@atproto/repo'
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
  crawlers: Crawlers
  appViewAgent?: AtpAgent
  moderationAgent?: AtpAgent
  reportingAgent?: AtpAgent
  entrywayAgent?: AtpAgent
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

    const authVerifier = new AuthVerifier(accountManager, idResolver, {
      jwtKey, // @TODO support multiple keys?
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
