import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { AccountService } from './account'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'
import { LabelService } from './label'
import { BackgroundQueue } from '../background'
import { Crawlers } from '../crawlers'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  blobstore: BlobStore
  backgroundQueue: BackgroundQueue
  crawlers: Crawlers
}): Services {
  const { repoSigningKey, blobstore, backgroundQueue, crawlers } = resources
  return {
    account: AccountService.creator(),
    auth: AuthService.creator(),
    record: RecordService.creator(),
    repo: RepoService.creator(
      repoSigningKey,
      blobstore,
      backgroundQueue,
      crawlers,
    ),
    moderation: ModerationService.creator(blobstore),
    label: LabelService.creator(),
  }
}

export type Services = {
  account: FromDb<AccountService>
  auth: FromDb<AuthService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
  moderation: FromDb<ModerationService>
  label: FromDb<LabelService>
}

type FromDb<T> = (db: Database) => T
