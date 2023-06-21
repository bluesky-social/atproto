import express from 'express'
import * as plc from '@did-plc/lib'
import * as crypto from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { Database } from './db'
import { ServerConfig } from './config'
import * as auth from './auth'
import { ServerMailer } from './mailer'
import { BlobStore } from '@atproto/repo'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import { MessageDispatcher } from './event-stream/message-queue'
import { Sequencer, SequencerLeader } from './sequencer'
import { Labeler } from './labeler'
import { BackgroundQueue } from './event-stream/background-queue'
import DidSqlCache from './did-cache'
import { MountedAlgos } from './feed-gen/types'
import { Crawlers } from './crawlers'

export class AppContext {
  private _appviewAgent: AtpAgent | null

  constructor(
    private opts: {
      db: Database
      blobstore: BlobStore
      repoSigningKey: crypto.Keypair
      plcRotationKey: crypto.Keypair
      idResolver: IdResolver
      didCache: DidSqlCache
      auth: auth.ServerAuth
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      mailer: ServerMailer
      services: Services
      messageDispatcher: MessageDispatcher
      sequencer: Sequencer
      sequencerLeader: SequencerLeader
      labeler: Labeler
      backgroundQueue: BackgroundQueue
      crawlers: Crawlers
      algos: MountedAlgos
    },
  ) {
    this._appviewAgent = opts.cfg.bskyAppViewEndpoint
      ? new AtpAgent({
          service: opts.cfg.bskyAppViewEndpoint,
        })
      : null
  }

  get db(): Database {
    return this.opts.db
  }

  get blobstore(): BlobStore {
    return this.opts.blobstore
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

  get adminVerifier() {
    return auth.adminVerifier(this.auth)
  }

  get moderatorVerifier() {
    return auth.moderatorVerifier(this.auth)
  }

  get optionalAccessOrAdminVerifier() {
    return auth.optionalAccessOrAdminVerifier(this.auth)
  }

  get imgUriBuilder(): ImageUriBuilder {
    return this.opts.imgUriBuilder
  }

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get mailer(): ServerMailer {
    return this.opts.mailer
  }

  get services(): Services {
    return this.opts.services
  }

  get messageDispatcher(): MessageDispatcher {
    return this.opts.messageDispatcher
  }

  get sequencer(): Sequencer {
    return this.opts.sequencer
  }

  get sequencerLeader(): SequencerLeader {
    return this.opts.sequencerLeader
  }

  get labeler(): Labeler {
    return this.opts.labeler
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

  get algos(): MountedAlgos {
    return this.opts.algos
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

  get appviewAgent(): AtpAgent {
    if (!this._appviewAgent) {
      throw new Error('Could not find bsky appview endpoint')
    }
    return this._appviewAgent
  }

  canProxy(req: express.Request): boolean {
    return (
      this.cfg.bskyAppViewEndpoint !== undefined &&
      req.get('x-appview-proxy') !== undefined
    )
  }
}

export default AppContext
