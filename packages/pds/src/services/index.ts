import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageDispatcher } from '../event-stream/message-queue'
import { AccountService } from './account'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'
import { IndexingService } from '../app-view/services/indexing'
import { Labeler } from '../labeler'
import { LabelService } from '../app-view/services/label'
import { BackgroundQueue } from '../event-stream/background-queue'
import { Crawlers } from '../crawlers'
import { LabelCache } from '../label-cache'
import { LocalService } from './local'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  messageDispatcher: MessageDispatcher
  blobstore: BlobStore
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
    messageDispatcher,
    blobstore,
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
    record: RecordService.creator(messageDispatcher),
    repo: RepoService.creator(
      repoSigningKey,
      messageDispatcher,
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
    moderation: ModerationService.creator(messageDispatcher, blobstore),
    appView: {
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
  local: FromDb<LocalService>
  moderation: FromDb<ModerationService>
  appView: {
    indexing: FromDb<IndexingService>
    label: FromDb<LabelService>
  }
}

type FromDb<T> = (db: Database) => T
