import * as crypto from '@atproto/crypto'
import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { AuthService } from './auth'
import { FeedService } from './feed'
import { RecordService } from './record'
import { RepoService } from './repo'
import { ModerationService } from './moderation'

export function createServices(resources: {
  keypair: crypto.Keypair
  messageQueue: MessageQueue
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
}): Services {
  const { keypair, messageQueue, blobstore, imgUriBuilder } = resources
  return {
    actor: ActorService.creator(),
    auth: AuthService.creator(),
    feed: FeedService.creator(imgUriBuilder),
    record: RecordService.creator(messageQueue),
    repo: RepoService.creator(keypair, messageQueue, blobstore),
    moderation: ModerationService.creator(messageQueue, blobstore),
  }
}

export type Services = {
  actor: FromDb<ActorService>
  auth: FromDb<AuthService>
  feed: FromDb<FeedService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
  moderation: FromDb<ModerationService>
}

type FromDb<T> = (db: Database) => T
