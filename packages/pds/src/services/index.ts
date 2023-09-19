import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
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
import { Labeler } from '../labeler'
import { LabelService } from '../app-view/services/label'
import { BackgroundQueue } from '../background'
import { Crawlers } from '../crawlers'
import { LabelCache } from '../label-cache'
import { LocalService } from './local'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  labeler: Labeler
  labelCache: LabelCache
  appviewAgent?: AtpAgent
  appviewDid?: string
  appviewCdnUrlPattern?: string
  backgroundQueue: BackgroundQueue
  crawlers: Crawlers
}): Services {
  const {
    repoSigningKey,
    blobstore,
    imgUriBuilder,
    imgInvalidator,
    labeler,
    labelCache,
    appviewAgent,
    appviewDid,
    appviewCdnUrlPattern,
    backgroundQueue,
    crawlers,
  } = resources
  return {
    account: AccountService.creator(),
    auth: AuthService.creator(),
    record: RecordService.creator(),
    repo: RepoService.creator(
      repoSigningKey,
      blobstore,
      backgroundQueue,
      crawlers,
      labeler,
    ),
    local: LocalService.creator(
      repoSigningKey,
      appviewAgent,
      appviewDid,
      appviewCdnUrlPattern,
    ),
    moderation: ModerationService.creator(
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    ),
    appView: {
      actor: ActorService.creator(imgUriBuilder, labelCache),
      graph: GraphService.creator(imgUriBuilder),
      feed: FeedService.creator(imgUriBuilder, labelCache),
      label: LabelService.creator(labelCache),
    },
  }
}

export type Services = {
  account: FromDb<AccountService>
  auth: FromDb<AuthService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
  local: FromDb<LocalService>
  moderation: FromDb<ModerationService>
  appView: {
    feed: FromDb<FeedService>
    actor: FromDb<ActorService>
    graph: FromDb<GraphService>
    label: FromDb<LabelService>
  }
}

type FromDb<T> = (db: Database) => T
