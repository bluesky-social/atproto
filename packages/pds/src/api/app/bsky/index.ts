import { Server } from '../../../lexicon'
import AppContext from '../../../context'
import getTimeline from './feed/getTimeline'
import getAuthorFeed from './feed/getAuthorFeed'
import getVotes from './feed/getVotes'
import setVote from './feed/setVote'
import getPostThread from './feed/getPostThread'
import createScene from './actor/createScene'
import getProfile from './actor/getProfile'
import updateProfile from './actor/updateProfile'
import getRepostedBy from './feed/getRepostedBy'
import getFollowers from './graph/getFollowers'
import getFollows from './graph/getFollows'
import getMembers from './graph/getMembers'
import getMemberships from './graph/getMemberships'
import getAssertions from './graph/getAssertions'
import getUsersSearch from './actor/search'
import getUsersTypeahead from './actor/searchTypeahead'
import getNotifications from './notification/list'
import getNotificationCount from './notification/getCount'
import getSuggestions from './actor/getSuggestions'
import postNotificationsSeen from './notification/updateSeen'
import takeModerationAction from './administration/takeModerationAction'
import reverseModerationAction from './administration/reverseModerationAction'

export default function (server: Server, ctx: AppContext) {
  createScene(server, ctx)
  getTimeline(server, ctx)
  getAuthorFeed(server, ctx)
  getVotes(server, ctx)
  setVote(server, ctx)
  getPostThread(server, ctx)
  getProfile(server, ctx)
  updateProfile(server, ctx)
  getRepostedBy(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  getMembers(server, ctx)
  getMemberships(server, ctx)
  getAssertions(server, ctx)
  getUsersSearch(server, ctx)
  getUsersTypeahead(server, ctx)
  getNotifications(server, ctx)
  getNotificationCount(server, ctx)
  getSuggestions(server, ctx)
  postNotificationsSeen(server, ctx)
  takeModerationAction(server, ctx)
  reverseModerationAction(server, ctx)
}
