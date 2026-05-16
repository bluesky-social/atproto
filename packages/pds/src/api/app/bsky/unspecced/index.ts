import { AppContext } from '../../../../context'
import { Server } from '../../../../lexicon'
import getPopularFeedGenerators from './getPopularFeedGenerators'
import getTrendingTopics from './getTrendingTopics'

export default function (server: Server, ctx: AppContext) {
  getPopularFeedGenerators(server, ctx)
  getTrendingTopics(server, ctx)
}
