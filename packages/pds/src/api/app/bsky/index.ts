import { Server } from '../../../lexicon'
import getTimeline from './feed/getTimeline'
import getAuthorFeed from './feed/getAuthorFeed'
import getLikedBy from './feed/getLikedBy'
import getPostThread from './feed/getPostThread'
import getProfile from './actor/getProfile'
import updateProfile from './actor/updateProfile'
import getRepostedBy from './feed/getRepostedBy'
import getUserFollowers from './graph/getFollowers'
import getUserFollows from './graph/getFollows'
import getUsersSearch from './actor/search'
import getUsersTypeahead from './actor/searchTypeahead'
import getNotifications from './notification/list'
import getNotificationCount from './notification/getCount'
import postNotificationsSeen from './notification/updateSeen'

export default function (server: Server) {
  getTimeline(server)
  getAuthorFeed(server)
  getLikedBy(server)
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
  postNotificationsSeen(server)
}
