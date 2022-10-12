import { Server } from '../../../lexicon'
import getHomeFeed from './getHomeFeed'
import getAuthorFeed from './getAuthorFeed'
import getLikedBy from './getLikedBy'
import getPostThread from './getPostThread'
import getProfile from './getProfile'
import getRepostedBy from './getRepostedBy'
import getUserFollowers from './getUserFollowers'
import getUserFollows from './getUserFollows'
import getNotifications from './getNotifications'
import getNotificationCount from './getNotificationCount'
import postNotificationsSeen from './postNotificationsSeen'

export default function (server: Server) {
  getHomeFeed(server)
  getAuthorFeed(server)
  getLikedBy(server)
  getPostThread(server)
  getProfile(server)
  getRepostedBy(server)
  getUserFollowers(server)
  getUserFollows(server)
  getNotifications(server)
  getNotificationCount(server)
  postNotificationsSeen(server)
}
