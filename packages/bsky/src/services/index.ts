import { DidResolver } from '@atproto/did-resolver'
import Database from '../db'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { IndexingService } from './indexing'
import { ModerationService } from './moderation'
import { LabelService } from './label'
import { ImageInvalidator } from '../image/invalidator'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  didResolver: DidResolver
}): Services {
  const { imgUriBuilder, imgInvalidator, didResolver } = resources
  return {
    actor: ActorService.creator(imgUriBuilder),
    feed: FeedService.creator(imgUriBuilder),
    indexing: IndexingService.creator(didResolver),
    moderation: ModerationService.creator(imgUriBuilder, imgInvalidator),
    label: LabelService.creator(),
  }
}

export type Services = {
  feed: FromDb<FeedService>
  indexing: FromDb<IndexingService>
  actor: FromDb<ActorService>
  moderation: FromDb<ModerationService>
  label: FromDb<LabelService>
}

type FromDb<T> = (db: Database) => T
