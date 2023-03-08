import Database from '../db'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { IndexingService } from './indexing'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
}): Services {
  const { imgUriBuilder } = resources
  return {
    actor: ActorService.creator(imgUriBuilder),
    feed: FeedService.creator(imgUriBuilder),
    indexing: IndexingService.creator(),
  }
}

export type Services = {
  feed: FromDb<FeedService>
  indexing: FromDb<IndexingService>
  actor: FromDb<ActorService>
}

type FromDb<T> = (db: Database) => T
