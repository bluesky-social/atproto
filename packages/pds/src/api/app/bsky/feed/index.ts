import { Server } from '../../../../lexicon'
import AppContext from '../../../../context'
import saveFeed from './saveFeed'
import unsaveFeed from './unsaveFeed'
import getSavedFeeds from './getSavedFeeds'

export default function (server: Server, ctx: AppContext) {
  saveFeed(server, ctx)
  unsaveFeed(server, ctx)
  getSavedFeeds(server, ctx)
}
