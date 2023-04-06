import { DidResolver } from '@atproto/did-resolver'
import Database from '../db'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { IndexingService } from './indexing'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  didResolver: DidResolver
}): Services {
  const { imgUriBuilder, didResolver } = resources
  return {
    actor: ActorService.creator(imgUriBuilder),
    feed: FeedService.creator(imgUriBuilder),
    indexing: IndexingService.creator(didResolver),
  }
}

export type Services = {
  feed: FromDb<FeedService>
  indexing: FromDb<IndexingService>
  actor: FromDb<ActorService>
}

type FromDb<T> = (db: Database) => T
