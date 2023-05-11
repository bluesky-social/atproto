import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import bookmarkFeed from './bookmarkFeed'
import unbookmarkFeed from './unbookmarkFeed'
import getBookmarkedFeeds from './getBookmarkedFeeds'

export default function (server: Server, ctx: AppContext) {
  bookmarkFeed(server, ctx)
  unbookmarkFeed(server, ctx)
  getBookmarkedFeeds(server, ctx)
}
