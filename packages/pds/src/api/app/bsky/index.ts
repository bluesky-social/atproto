import { Server } from '../../../lexicon'
import getTimeline from './feed/getTimeline'
import getAuthorFeed from './feed/getAuthorFeed'
import getVotes from './feed/getVotes'
import getPostThread from './feed/getPostThread'
import createScene from './actor/createScene'
import getProfile from './actor/getProfile'
import updateProfile from './actor/updateProfile'
import getRepostedBy from './feed/getRepostedBy'
import getUserFollowers from './graph/getFollowers'
import getUserFollows from './graph/getFollows'
import getUsersSearch from './actor/search'
import getUsersTypeahead from './actor/searchTypeahead'
import getNotifications from './notification/list'
import getNotificationCount from './notification/getCount'
import getSuggestions from './actor/getSuggestions'
import postNotificationsSeen from './notification/updateSeen'

export default function (server: Server) {
  createScene(server)
  getTimeline(server)
  getAuthorFeed(server)
  getVotes(server)
  getPostThread(server)
  getProfile(server)
  updateProfile(server)
  getRepostedBy(server)
  getUserFollowers(server)
  getUserFollows(server)
  getUsersSearch(server)
  getUsersTypeahead(server)
  getNotifications(server)
  getNotificationCount(server)
  getSuggestions(server)
  postNotificationsSeen(server)
}
