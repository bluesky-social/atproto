import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { ImageUriBuilder } from '../image/uri'
import { ImageInvalidator } from '../image/invalidator'
import { ActorService } from './actor'
import { AuthService } from './auth'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'
import { FeedService } from '../app-view/services/feed'

export function createServices(resources: {
  keypair: crypto.Keypair
  messageQueue: MessageQueue
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
}): Services {
  const { keypair, messageQueue, blobstore, imgUriBuilder, imgInvalidator } =
    resources
  return {
    actor: ActorService.creator(imgUriBuilder),
    auth: AuthService.creator(),
    record: RecordService.creator(messageQueue),
    repo: RepoService.creator(keypair, messageQueue, blobstore),
    moderation: ModerationService.creator(
      messageQueue,
      blobstore,
      imgUriBuilder,
      imgInvalidator,
    ),
    appView: {
      feed: FeedService.creator(imgUriBuilder),
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
  }
}

type FromDb<T> = (db: Database) => T
