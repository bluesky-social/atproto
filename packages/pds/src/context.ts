import { Redis } from 'ioredis'
import * as plc from '@did-plc/lib'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { Database } from './db'
import { ServerConfig } from './config'
import * as auth from './auth'
import { ServerMailer } from './mailer'
import { ModerationMailer } from './mailer/moderation'
import { BlobStore } from '@atproto/repo'
import { Services } from './services'
import { Sequencer, SequencerLeader } from './sequencer'
import { BackgroundQueue } from './background'
import DidSqlCache from './did-cache'
import { Crawlers } from './crawlers'
import { RuntimeFlags } from './runtime-flags'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      blobstore: BlobStore
      redisScratch?: Redis
      repoSigningKey: crypto.Keypair
      plcRotationKey: crypto.Keypair
      idResolver: IdResolver
      didCache: DidSqlCache
      auth: auth.ServerAuth
      cfg: ServerConfig
      mailer: ServerMailer
      moderationMailer: ModerationMailer
      services: Services
      sequencer: Sequencer
      sequencerLeader: SequencerLeader | null
      runtimeFlags: RuntimeFlags
      backgroundQueue: BackgroundQueue
      appviewAgent: AtpAgent
      crawlers: Crawlers
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get blobstore(): BlobStore {
    return this.opts.blobstore
  }

  get redisScratch(): Redis | undefined {
    return this.opts.redisScratch
  }

  get repoSigningKey(): crypto.Keypair {
    return this.opts.repoSigningKey
  }

  get plcRotationKey(): crypto.Keypair {
    return this.opts.plcRotationKey
  }

  get auth(): auth.ServerAuth {
    return this.opts.auth
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

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get mailer(): ServerMailer {
    return this.opts.mailer
  }

  get moderationMailer(): ModerationMailer {
    return this.opts.moderationMailer
  }

  get services(): Services {
    return this.opts.services
  }

  get sequencer(): Sequencer {
    return this.opts.sequencer
  }

  get sequencerLeader(): SequencerLeader | null {
    return this.opts.sequencerLeader
  }

  get runtimeFlags(): RuntimeFlags {
    return this.opts.runtimeFlags
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }

  get crawlers(): Crawlers {
    return this.opts.crawlers
  }

  get plcClient(): plc.Client {
    return new plc.Client(this.cfg.didPlcUrl)
  }

  get idResolver(): IdResolver {
    return this.opts.idResolver
  }

  get didCache(): DidSqlCache {
    return this.opts.didCache
  }

  get appviewAgent(): AtpAgent {
    return this.opts.appviewAgent
  }

  async serviceAuthHeaders(did: string, audience?: string) {
    const aud = audience ?? this.cfg.bskyAppViewDid
    if (!aud) {
      throw new Error('Could not find bsky appview did')
    }
    return createServiceAuthHeaders({
      iss: did,
      aud,
      keypair: this.repoSigningKey,
    })
  }

  shouldProxyModeration(): boolean {
    return (
      this.cfg.bskyAppViewEndpoint !== undefined &&
      this.cfg.bskyAppViewModeration === true
    )
  }

  canProxyWrite(): boolean {
    return (
      this.cfg.bskyAppViewEndpoint !== undefined &&
      this.cfg.bskyAppViewDid !== undefined
    )
  }
}

export default AppContext
