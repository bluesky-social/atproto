import * as nodemailer from 'nodemailer'
import { Redis } from 'ioredis'
import * as plc from '@did-plc/lib'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { Database } from './db'
import { ServerConfig, ServerSecrets } from './config'
import * as auth from './auth'
import { ServerAuth } from './auth'
import { ServerMailer } from './mailer'
import { ModerationMailer } from './mailer/moderation'
import { BlobStore } from '@atproto/repo'
import { Services, createServices } from './services'
import { Sequencer, SequencerLeader } from './sequencer'
import { BackgroundQueue } from './background'
import DidSqlCache from './did-cache'
import { Crawlers } from './crawlers'
import { DiskBlobStore } from './storage'
import { getRedisClient } from './redis'
import { RuntimeFlags } from './runtime-flags'

export type AppContextOptions = {
  db: Database
  blobstore: BlobStore
  mailer: ServerMailer
  moderationMailer: ModerationMailer
  didCache: DidSqlCache
  idResolver: IdResolver
  plcClient: plc.Client
  services: Services
  sequencer: Sequencer
  sequencerLeader?: SequencerLeader
  backgroundQueue: BackgroundQueue
  runtimeFlags: RuntimeFlags
  redisScratch?: Redis
  crawlers: Crawlers
  appViewAgent: AtpAgent
  auth: auth.ServerAuth
  repoSigningKey: crypto.Keypair
  plcRotationKey: crypto.Keypair
  cfg: ServerConfig
}

export class AppContext {
  public db: Database
  public blobstore: BlobStore
  public mailer: ServerMailer
  public moderationMailer: ModerationMailer
  public didCache: DidSqlCache
  public idResolver: IdResolver
  public plcClient: plc.Client
  public services: Services
  public sequencer: Sequencer
  public sequencerLeader?: SequencerLeader
  public backgroundQueue: BackgroundQueue
  public runtimeFlags: RuntimeFlags
  public redisScratch?: Redis
  public crawlers: Crawlers
  public appViewAgent: AtpAgent
  public auth: auth.ServerAuth
  public repoSigningKey: crypto.Keypair
  public plcRotationKey: crypto.Keypair
  public cfg: ServerConfig

  constructor(opts: AppContextOptions) {
    this.db = opts.db
    this.blobstore = opts.blobstore
    this.mailer = opts.mailer
    this.moderationMailer = opts.moderationMailer
    this.didCache = opts.didCache
    this.idResolver = opts.idResolver
    this.plcClient = opts.plcClient
    this.services = opts.services
    this.sequencer = opts.sequencer
    this.sequencerLeader = opts.sequencerLeader
    this.backgroundQueue = opts.backgroundQueue
    this.runtimeFlags = opts.runtimeFlags
    this.redisScratch = opts.redisScratch
    this.crawlers = opts.crawlers
    this.appViewAgent = opts.appViewAgent
    this.auth = opts.auth
    this.repoSigningKey = opts.repoSigningKey
    this.plcRotationKey = opts.plcRotationKey
    this.cfg = opts.cfg
  }

  static async fromConfig(
    cfg: ServerConfig,
    secrets: ServerSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<AppContext> {
    const db =
      cfg.db.dialect === 'sqlite'
        ? Database.sqlite(cfg.db.location)
        : Database.postgres({
            url: cfg.db.url,
            schema: cfg.db.schema,
            poolSize: cfg.db.pool.size,
            poolMaxUses: cfg.db.pool.maxUses,
            poolIdleTimeoutMs: cfg.db.pool.idleTimeoutMs,
          })
    const blobstore =
      cfg.blobstore.provider === 's3'
        ? new S3BlobStore({ bucket: cfg.blobstore.bucket })
        : await DiskBlobStore.create(
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

    const didCache = new DidSqlCache(
      db,
      cfg.identity.cacheStaleTTL,
      cfg.identity.cacheMaxTTL,
    )
    const idResolver = new IdResolver({
      plcUrl: cfg.identity.plcUrl,
      didCache,
      timeout: cfg.identity.resolverTimeout,
      backupNameservers: cfg.identity.handleBackupNameservers,
    })
    const plcClient = new plc.Client(cfg.identity.plcUrl)

    const sequencer = new Sequencer(db)
    const sequencerLeader = cfg.subscription.sequencerLeaderEnabled
      ? new SequencerLeader(db, cfg.subscription.sequencerLeaderLockId)
      : undefined

    const backgroundQueue = new BackgroundQueue(db)
    const runtimeFlags = new RuntimeFlags(db)
    const redisScratch = cfg.redis
      ? getRedisClient(cfg.redis.address, cfg.redis.password)
      : undefined

    const crawlers = new Crawlers(cfg.service.hostname, cfg.crawlers)

    const appViewAgent = new AtpAgent({ service: cfg.bskyAppView.url })

    const auth = new ServerAuth({
      jwtSecret: secrets.jwtSecret,
      adminPass: secrets.adminPassword,
      moderatorPass: secrets.moderatorPassword,
      triagePass: secrets.triagePassword,
    })

    const repoSigningKey =
      secrets.repoSigningKey.provider === 'kms'
        ? await KmsKeypair.load({
            keyId: secrets.repoSigningKey.keyId,
          })
        : await crypto.Secp256k1Keypair.import(
            secrets.repoSigningKey.privateKeyHex,
          )

    const plcRotationKey =
      secrets.plcRotationKey.provider === 'kms'
        ? await KmsKeypair.load({
            keyId: secrets.plcRotationKey.keyId,
          })
        : await crypto.Secp256k1Keypair.import(
            secrets.plcRotationKey.privateKeyHex,
          )

    const services = createServices({
      repoSigningKey,
      blobstore,
      appViewAgent,
      pdsHostname: cfg.service.hostname,
      appViewDid: cfg.bskyAppView.did,
      appViewCdnUrlPattern: cfg.bskyAppView.cdnUrlPattern,
      backgroundQueue,
      crawlers,
    })

    return new AppContext({
      db,
      blobstore,
      mailer,
      moderationMailer,
      didCache,
      idResolver,
      plcClient,
      services,
      sequencer,
      sequencerLeader,
      backgroundQueue,
      runtimeFlags,
      redisScratch,
      crawlers,
      appViewAgent,
      auth,
      repoSigningKey,
      plcRotationKey,
      cfg,
      ...(overrides ?? {}),
    })
  }

  get accessVerifier() {
    return auth.accessVerifier(this.auth)
  }

  get accessVerifierNotAppPassword() {
    return auth.accessVerifierNotAppPassword(this.auth)
  }

  get accessVerifierCheckTakedown() {
    return auth.accessVerifierCheckTakedown(this.auth, this)
  }

  get refreshVerifier() {
    return auth.refreshVerifier(this.auth)
  }

  get roleVerifier() {
    return auth.roleVerifier(this.auth)
  }

  get accessOrRoleVerifier() {
    return auth.accessOrRoleVerifier(this.auth)
  }

  get optionalAccessOrRoleVerifier() {
    return auth.optionalAccessOrRoleVerifier(this.auth)
  }

  async serviceAuthHeaders(did: string, audience?: string) {
    const aud = audience ?? this.cfg.bskyAppView.did
    if (!aud) {
      throw new Error('Could not find bsky appview did')
    }
    return createServiceAuthHeaders({
      iss: did,
      aud,
      keypair: this.repoSigningKey,
    })
  }
}

export default AppContext
