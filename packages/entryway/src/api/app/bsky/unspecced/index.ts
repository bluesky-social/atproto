import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import getPopular from './getPopular'
import getPopularFeedGenerators from './getPopularFeedGenerators'

// THIS IS A TEMPORARY UNSPECCED ROUTE
export default function (server: Server, ctx: AppContext) {
  getPopular(server, ctx)
  getPopularFeedGenerators(server, ctx)
}
