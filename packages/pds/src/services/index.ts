import { BlobStore } from '@atproto/repo'
import Database from '../db'
import { MessageQueue } from '../event-stream/types'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { AuthService } from './auth'
import { FeedService } from './feed'
import { RecordService } from './record'
import { RepoService } from './repo'
import { AdminService } from './admin'

export function createServices(resources: {
  messageQueue: MessageQueue
  blobstore: BlobStore
  imgUriBuilder: ImageUriBuilder
}): Services {
  const { messageQueue, blobstore, imgUriBuilder } = resources
  const services = {
    get actor() {
      return ActorService.creator(services)
    },
    get auth() {
      return AuthService.creator(services)
    },
    get feed() {
      return FeedService.creator(services, imgUriBuilder)
    },
    get record() {
      return RecordService.creator(services, messageQueue)
    },
    get repo() {
      return RepoService.creator(services, messageQueue, blobstore)
    },
    get admin() {
      return AdminService.creator(services)
    },
  }
  return services
}

export type Services = {
  actor: FromDb<ActorService>
  auth: FromDb<AuthService>
  feed: FromDb<FeedService>
  record: FromDb<RecordService>
  repo: FromDb<RepoService>
  admin: FromDb<AdminService>
}

type FromDb<T> = (db: Database) => T
