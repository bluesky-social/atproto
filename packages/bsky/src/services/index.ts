import { Database, PrimaryDatabase } from '../db'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { GraphService } from './graph'
import { ModerationService } from './moderation'
import { LabelService } from './label'
import { ImageInvalidator } from '../image/invalidator'
import { LabelCache } from '../label-cache'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  labelCache: LabelCache
}): Services {
  const { imgUriBuilder, imgInvalidator, labelCache } = resources
  return {
    actor: ActorService.creator(imgUriBuilder, labelCache),
    feed: FeedService.creator(imgUriBuilder, labelCache),
    graph: GraphService.creator(imgUriBuilder),
    moderation: ModerationService.creator(imgUriBuilder, imgInvalidator),
    label: LabelService.creator(labelCache),
  }
}

export type Services = {
  actor: FromDb<ActorService>
  feed: FromDb<FeedService>
  graph: FromDb<GraphService>
  moderation: FromDbPrimary<ModerationService>
  label: FromDb<LabelService>
}

type FromDb<T> = (db: Database) => T

type FromDbPrimary<T> = (db: PrimaryDatabase) => T
