import * as nodemailer from 'nodemailer'
import { Redis } from 'ioredis'
import { RateLimiterRedis } from 'rate-limiter-flexible'
import * as plc from '@did-plc/lib'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { KmsKeypair, S3BlobStore } from '@atproto/aws'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { Database } from './db'
import { ServerConfig, ServerSecrets } from './config'
import { AuthVerifier, getAuthKeys } from './auth-verifier'
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
import { PdsAgents } from './pds-agents'
import assert from 'assert'
import { SignupLimiter } from './signup-queue/limiter'
import { SignupActivator } from './signup-queue/activator'
import { createCourierClient, authWithApiKey as courierAuth } from './courier'
import { DAY } from '@atproto/common'
import { PhoneVerifier } from './phone-verification/util'
import { TwilioClient } from './phone-verification/twilio'
import { PlivoClient } from './phone-verification/plivo'
import { MultiVerifier } from './phone-verification/multi'

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
  moderationAgent: AtpAgent
  authVerifier: AuthVerifier
  pdsAgents: PdsAgents
  repoSigningKey: crypto.Keypair
  plcRotationKey: crypto.Keypair
  phoneVerifier?: PhoneVerifier
  signupLimiter: SignupLimiter
  signupActivator: SignupActivator
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
  public moderationAgent: AtpAgent
  public authVerifier: AuthVerifier
  public pdsAgents: PdsAgents
  public repoSigningKey: crypto.Keypair
  public plcRotationKey: crypto.Keypair
  public phoneVerifier?: PhoneVerifier
  public signupLimiter: SignupLimiter
  public signupActivator: SignupActivator
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
    this.moderationAgent = opts.moderationAgent
    this.authVerifier = opts.authVerifier
    this.pdsAgents = opts.pdsAgents
    this.repoSigningKey = opts.repoSigningKey
    this.plcRotationKey = opts.plcRotationKey
    this.phoneVerifier = opts.phoneVerifier
    this.signupLimiter = opts.signupLimiter
    this.signupActivator = opts.signupActivator
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
        ? new S3BlobStore({
            bucket: cfg.blobstore.bucket,
            region: cfg.blobstore.region,
            endpoint: cfg.blobstore.endpoint,
            forcePathStyle: cfg.blobstore.forcePathStyle,
            credentials: cfg.blobstore.credentials,
          })
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
    const moderationAgent = new AtpAgent({ service: cfg.modService.url })

    const authKeys = await getAuthKeys(secrets)

    const authVerifier = new AuthVerifier(db, idResolver, {
      authKeys,
      adminPass: secrets.adminPassword,
      moderatorPass: secrets.moderatorPassword,
      triagePass: secrets.triagePassword,
      pdsServiceDid: cfg.service.did,
      modServiceDid: cfg.modService.did,
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
      authKeys,
      identityDid: cfg.service.did,
      appViewDid: cfg.bskyAppView.did,
      appViewCdnUrlPattern: cfg.bskyAppView.cdnUrlPattern,
      backgroundQueue,
      crawlers,
    })

    let phoneVerifier: PhoneVerifier | undefined = undefined
    if (cfg.phoneVerification.required) {
      if (cfg.phoneVerification.provider.provider === 'twilio') {
        assert(secrets.twilioAuthToken, 'expected twilio auth token')
        phoneVerifier = new TwilioClient({
          accountSid: cfg.phoneVerification.provider.accountSid,
          serviceSid: cfg.phoneVerification.provider.serviceSid,
          authToken: secrets.twilioAuthToken,
        })
      } else if (cfg.phoneVerification.provider.provider === 'plivo') {
        assert(secrets.plivoAuthToken, 'expected plivo auth token')
        phoneVerifier = new PlivoClient(db, {
          authId: cfg.phoneVerification.provider.authId,
          appId: cfg.phoneVerification.provider.appId,
          authToken: secrets.plivoAuthToken,
        })
      } else if (cfg.phoneVerification.provider.provider === 'multi') {
        assert(secrets.twilioAuthToken, 'expected twilio auth token')
        assert(secrets.plivoAuthToken, 'expected plivo auth token')
        const twilio = new TwilioClient({
          accountSid: cfg.phoneVerification.provider.twilio.accountSid,
          serviceSid: cfg.phoneVerification.provider.twilio.serviceSid,
          authToken: secrets.twilioAuthToken,
        })
        const plivo = new PlivoClient(db, {
          authId: cfg.phoneVerification.provider.plivo.authId,
          appId: cfg.phoneVerification.provider.plivo.appId,
          authToken: secrets.plivoAuthToken,
        })
        phoneVerifier = new MultiVerifier(db, twilio, plivo)
      }
    }

    const signupLimiter = new SignupLimiter(db)
    const courierClient = cfg.activator.courierUrl
      ? createCourierClient({
          baseUrl: cfg.activator.courierUrl,
          httpVersion: cfg.activator.courierHttpVersion ?? '2',
          nodeOptions: {
            rejectUnauthorized: !cfg.activator.courierIgnoreBadTls,
          },
          interceptors: cfg.activator.courierApiKey
            ? [courierAuth(cfg.activator.courierApiKey)]
            : [],
        })
      : undefined
    const limiter =
      cfg.activator.emailsPerDay && redisScratch
        ? new RateLimiterRedis({
            storeClient: redisScratch,
            duration: DAY / 1000,
            points: cfg.activator.emailsPerDay,
          })
        : undefined

    const signupActivator = new SignupActivator({
      db,
      mailer,
      courierClient,
      limiter,
    })

    const pdsAgents = new PdsAgents()

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
      moderationAgent,
      authVerifier,
      repoSigningKey,
      plcRotationKey,
      pdsAgents,
      phoneVerifier,
      signupLimiter,
      signupActivator,
      cfg,
      ...(overrides ?? {}),
    })
  }

  async appviewAuthHeaders(did: string) {
    return this.serviceAuthHeaders(did, this.cfg.bskyAppView.did)
  }

  async moderationAuthHeaders(did: string) {
    return this.serviceAuthHeaders(did, this.cfg.modService.did)
  }

  async serviceAuthHeaders(did: string, aud: string) {
    return createServiceAuthHeaders({
      iss: did,
      aud,
      keypair: this.repoSigningKey,
    })
  }
}

export default AppContext
