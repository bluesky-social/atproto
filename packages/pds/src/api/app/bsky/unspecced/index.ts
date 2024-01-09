import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getPopularFeedGenerators from './getPopularFeedGenerators'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  getPopularFeedGenerators(server, ctx)
}
