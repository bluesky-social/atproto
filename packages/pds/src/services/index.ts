import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
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
import { Labeler } from '../labeler'
import { LabelService } from '../app-view/services/label'
import { BackgroundQueue } from '../event-stream/background-queue'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  messageDispatcher: MessageDispatcher
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  labeler: Labeler
  backgroundQueue: BackgroundQueue
}): Services {
  const {
    repoSigningKey,
    messageDispatcher,
    blobstore,
    imgUriBuilder,
    imgInvalidator,
    labeler,
    backgroundQueue,
  } = resources
  return {
    account: AccountService.creator(),
    auth: AuthService.creator(),
    record: RecordService.creator(messageDispatcher),
    repo: RepoService.creator(
      repoSigningKey,
      messageDispatcher,
      blobstore,
      labeler,
    ),
    moderation: ModerationService.creator(
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    ),
    appView: {
      actor: ActorService.creator(imgUriBuilder),
      feed: FeedService.creator(imgUriBuilder),
      indexing: IndexingService.creator(backgroundQueue),
      label: LabelService.creator(),
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
    label: FromDb<LabelService>
  }
}

type FromDb<T> = (db: Database) => T
