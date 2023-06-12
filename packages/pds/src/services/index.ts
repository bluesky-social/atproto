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
import { LabelService } from './label'
import { Labeler } from '../labeler'
import { BackgroundQueue } from '../event-stream/background-queue'
import { Crawlers } from '../crawlers'

export function createServices(resources: {
  repoSigningKey: crypto.Keypair
  messageDispatcher: MessageDispatcher
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  labeler: Labeler
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
    moderation: ModerationService.creator(
      messageDispatcher,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    ),
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
