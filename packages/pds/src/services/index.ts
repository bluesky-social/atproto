import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { MessageDispatcher } from '../event-stream/message-queue'
import { ImageUriBuilder } from '../image/uri'
import { ImageInvalidator } from '../image/invalidator'
import { ActorService } from './actor'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'
import { FeedService } from '../app-view/services/feed'
import { IndexingService } from '../app-view/services/indexing'
import { ActorService as AppViewActorService } from '../app-view/services/actor'

export function createServices(resources: {
  keypair: crypto.Keypair
  messageQueue: MessageQueue
  messageDispatcher: MessageDispatcher
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
}): Services {
  const {
    keypair,
    messageQueue,
    messageDispatcher,
    blobstore,
    imgUriBuilder,
    imgInvalidator,
  } = resources
  return {
    actor: ActorService.creator(imgUriBuilder),
    auth: AuthService.creator(),
    record: RecordService.creator(messageDispatcher),
    repo: RepoService.creator(keypair, messageDispatcher, blobstore),
    moderation: ModerationService.creator(
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    ),
    appView: {
      feed: FeedService.creator(imgUriBuilder),
      indexing: IndexingService.creator(messageQueue, messageDispatcher),
      actor: AppViewActorService.creator(imgUriBuilder),
    },
  }
}

export type Services = {
  actor: FromDb<ActorService>
  auth: FromDb<AuthService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
  moderation: FromDb<ModerationService>
  appView: {
    feed: FromDb<FeedService>
    indexing: FromDb<IndexingService>
    actor: FromDb<AppViewActorService>
  }
}

type FromDb<T> = (db: Database) => T
