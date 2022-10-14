import { Server } from '../../../lexicon'
import getHomeFeed from './getHomeFeed'
import getAuthorFeed from './getAuthorFeed'
import getBadgeMembers from './getBadgeMembers'
import getLikedBy from './getLikedBy'
import getPostThread from './getPostThread'
import getProfile from './getProfile'
import updateProfile from './updateProfile'
import getRepostedBy from './getRepostedBy'
import getUserFollowers from './getUserFollowers'
import getUserFollows from './getUserFollows'
import getNotifications from './getNotifications'
import getNotificationCount from './getNotificationCount'
import postNotificationsSeen from './postNotificationsSeen'

export default function (server: Server) {
  getHomeFeed(server)
  getAuthorFeed(server)
  getBadgeMembers(server)
  getLikedBy(server)
  getPostThread(server)
  getProfile(server)
  updateProfile(server)
  getRepostedBy(server)
  getUserFollowers(server)
  getUserFollows(server)
  getNotifications(server)
  getNotificationCount(server)
  postNotificationsSeen(server)
}
