import { ImageUriBuilder } from '../image/uri'
import { ActorService } from './actor'
import { FeedService } from './feed'
import { GraphService } from './graph'
import { ModerationService } from './moderation'
import { LabelCacheOpts, LabelService } from './label'
import { ImageInvalidator } from '../image/invalidator'
import { FromDb, FromDbPrimary } from './types'

export function createServices(resources: {
  imgUriBuilder: ImageUriBuilder
  imgInvalidator: ImageInvalidator
  labelCacheOpts: LabelCacheOpts
}): Services {
  const { imgUriBuilder, imgInvalidator, labelCacheOpts } = resources
  const label = LabelService.creator(labelCacheOpts)
  const graph = GraphService.creator(imgUriBuilder)
  const actor = ActorService.creator(imgUriBuilder, graph, label)
  const moderation = ModerationService.creator(imgUriBuilder, imgInvalidator)
  const feed = FeedService.creator(imgUriBuilder, actor, label, graph)
  return {
    actor,
    feed,
    moderation,
    graph,
    label,
  }
}

export type Services = {
  actor: FromDb<ActorService>
  feed: FromDb<FeedService>
  graph: FromDb<GraphService>
  moderation: FromDbPrimary<ModerationService>
  label: FromDb<LabelService>
}
