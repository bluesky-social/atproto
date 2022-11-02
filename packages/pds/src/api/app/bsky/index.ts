import { Server } from '../../../lexicon'
import getTimeline from './getTimeline'
import getAuthorFeed from './getAuthorFeed'
import getLikedBy from './getLikedBy'
import getPostThread from './getPostThread'
import getProfile from './getProfile'
import updateProfile from './updateProfile'
import getRepostedBy from './getRepostedBy'
import getUserFollowers from './getUserFollowers'
import getUserFollows from './getUserFollows'
import getUsersSearch from './getUsersSearch'
import getUsersTypeahead from './getUsersTypeahead'
import getNotifications from './getNotifications'
import getNotificationCount from './getNotificationCount'
import postNotificationsSeen from './postNotificationsSeen'

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
