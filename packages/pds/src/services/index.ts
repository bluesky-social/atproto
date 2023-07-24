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
import { GraphService } from '../app-view/services/graph'
import { FeedService } from '../app-view/services/feed'
import { IndexingService } from '../app-view/services/indexing'
import { Labeler } from '../labeler'
import { LabelService } from '../app-view/services/label'
import { BackgroundQueue } from '../event-stream/background-queue'
import { Crawlers } from '../crawlers'
import { LabelCache } from '../label-cache'
import { ContentReporter } from '../content-reporter'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  messageDispatcher: MessageDispatcher
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  labeler: Labeler
  labelCache: LabelCache
  contentReporter?: ContentReporter
  backgroundQueue: BackgroundQueue
  crawlers: Crawlers
}): Services {
  const {
    repoSigningKey,
    messageDispatcher,
    blobstore,
    imgUriBuilder,
    imgInvalidator,
    labeler,
    labelCache,
    contentReporter,
    backgroundQueue,
    crawlers,
  } = resources
  return {
    account: AccountService.creator(),
    auth: AuthService.creator(),
    record: RecordService.creator(messageDispatcher),
    repo: RepoService.creator(
      repoSigningKey,
      messageDispatcher,
      blobstore,
      backgroundQueue,
      crawlers,
      labeler,
      contentReporter,
    ),
    moderation: ModerationService.creator(
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    ),
    appView: {
      actor: ActorService.creator(imgUriBuilder, labelCache),
      graph: GraphService.creator(imgUriBuilder),
      feed: FeedService.creator(imgUriBuilder, labelCache),
      indexing: IndexingService.creator(backgroundQueue),
      label: LabelService.creator(labelCache),
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
    graph: FromDb<GraphService>
    label: FromDb<LabelService>
  }
}

type FromDb<T> = (db: Database) => T
