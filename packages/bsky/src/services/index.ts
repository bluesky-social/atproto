import Database from '../db'
import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { GraphService } from './graph'
import { ModerationService } from './moderation'
import { LabelService } from './label'
import { ImageInvalidator } from '../image/invalidator'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
}): Services {
  const { imgUriBuilder, imgInvalidator } = resources
  return {
    actor: ActorService.creator(imgUriBuilder),
    feed: FeedService.creator(imgUriBuilder),
    graph: GraphService.creator(imgUriBuilder),
    moderation: ModerationService.creator(imgUriBuilder, imgInvalidator),
    label: LabelService.creator(),
  }
}

export type Services = {
  actor: FromDb<ActorService>
  feed: FromDb<FeedService>
  graph: FromDb<GraphService>
  moderation: FromDb<ModerationService>
  label: FromDb<LabelService>
}

type FromDb<T> = (db: Database) => T
