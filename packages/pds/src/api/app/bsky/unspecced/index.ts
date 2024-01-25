import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getPopularFeedGenerators from './getPopularFeedGenerators'
import getTaggedSuggestions from './getTaggedSuggestions'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  getPopularFeedGenerators(server, ctx)
  getTaggedSuggestions(server, ctx)
}
