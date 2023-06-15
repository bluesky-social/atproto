import { IdResolver } from '@atproto/identity'
import Database from '../db'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { GraphService } from './graph'
import { IndexingService } from './indexing'
import { ModerationService } from './moderation'
import { LabelService } from './label'
import { ImageInvalidator } from '../image/invalidator'
import { Labeler } from '../labeler'
import { BackgroundQueue } from '../background'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  idResolver: IdResolver
  labeler: Labeler
  backgroundQueue: BackgroundQueue
}): Services {
  const {
    imgUriBuilder,
    imgInvalidator,
    idResolver,
    labeler,
    backgroundQueue,
  } = resources
  return {
    actor: ActorService.creator(imgUriBuilder),
    feed: FeedService.creator(imgUriBuilder),
    graph: GraphService.creator(imgUriBuilder),
    indexing: IndexingService.creator(idResolver, labeler, backgroundQueue),
    moderation: ModerationService.creator(imgUriBuilder, imgInvalidator),
    label: LabelService.creator(),
  }
}

export type Services = {
  actor: FromDb<ActorService>
  feed: FromDb<FeedService>
  graph: FromDb<GraphService>
  indexing: FromDb<IndexingService>
  moderation: FromDb<ModerationService>
  label: FromDb<LabelService>
}

type FromDb<T> = (db: Database) => T
