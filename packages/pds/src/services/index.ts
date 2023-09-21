import { AtpAgent } from '@atproto/api'
import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { AccountService } from './account'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'
import { Labeler } from '../labeler'
import { LabelService } from '../app-view/services/label'
import { BackgroundQueue } from '../background'
import { Crawlers } from '../crawlers'
import { LabelCache } from '../label-cache'
import { LocalService } from './local'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
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
    moderation: ModerationService.creator(blobstore),
    appView: {
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
    label: FromDb<LabelService>
  }
}

type FromDb<T> = (db: Database) => T
