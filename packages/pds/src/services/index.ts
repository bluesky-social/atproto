import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { MessageDispatcher } from '../event-stream/message-queue'
import { ImageUriBuilder } from '../image/uri'
import { ImageInvalidator } from '../image/invalidator'
import { AccountService } from './account'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'
import { ActorService } from '../app-view/services/actor'
import { FeedService } from '../app-view/services/feed'
import { IndexingService } from '../app-view/services/indexing'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  messageQueue: MessageQueue
  messageDispatcher: MessageDispatcher
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
}): Services {
  const {
    repoSigningKey,
    messageQueue,
    messageDispatcher,
    blobstore,
    imgUriBuilder,
    imgInvalidator,
  } = resources
  return {
    account: AccountService.creator(),
    auth: AuthService.creator(),
    record: RecordService.creator(messageDispatcher),
    repo: RepoService.creator(repoSigningKey, messageDispatcher, blobstore),
    moderation: ModerationService.creator(
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    ),
    appView: {
      actor: ActorService.creator(imgUriBuilder),
      feed: FeedService.creator(imgUriBuilder),
      indexing: IndexingService.creator(messageQueue, messageDispatcher),
    },
  }
}

export type Services = {
  account: FromDb<AccountService>
  auth: FromDb<AuthService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
  moderation: FromDb<ModerationService>
  appView: {
    feed: FromDb<FeedService>
    indexing: FromDb<IndexingService>
    actor: FromDb<ActorService>
  }
}

type FromDb<T> = (db: Database) => T
