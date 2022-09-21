import { Server } from '../../../lexicon'
import getFeed from './getFeed'
import getLikedBy from './getLikedBy'
import getPostThread from './getPostThread'
import getProfile from './getProfile'
import getRepostedBy from './getRepostedBy'
import getUserFollowers from './getUserFollowers'
import getUserFollows from './getUserFollows'

export default function (server: Server) {
  getFeed(server)
  getLikedBy(server)
  getPostThread(server)
  getProfile(server)
  getRepostedBy(server)
  getUserFollowers(server)
  getUserFollows(server)
}
