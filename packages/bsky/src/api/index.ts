import { Server } from '../lexicon'
import AppContext from '../context'
import getTimeline from './app/bsky/feed/getTimeline'
import getAuthorFeed from './app/bsky/feed/getAuthorFeed'
import getLikes from './app/bsky/feed/getLikes'
import getPostThread from './app/bsky/feed/getPostThread'
import getPosts from './app/bsky/feed/getPosts'
import getProfile from './app/bsky/actor/getProfile'
import getProfiles from './app/bsky/actor/getProfiles'
import getRepostedBy from './app/bsky/feed/getRepostedBy'
import getFollowers from './app/bsky/graph/getFollowers'
import getFollows from './app/bsky/graph/getFollows'
import searchActors from './app/bsky/actor/searchActors'
import searchActorsTypeahead from './app/bsky/actor/searchActorsTypeahead'
import getSuggestions from './app/bsky/actor/getSuggestions'
import getUnreadCount from './app/bsky/notification/getUnreadCount'
import listNotifications from './app/bsky/notification/listNotifications'
import unspecced from './app/bsky/unspecced'
import createReport from './com/atproto/moderation/createReport'
import resolveModerationReports from './com/atproto/admin/resolveModerationReports'
import reverseModerationAction from './com/atproto/admin/reverseModerationAction'
import takeModerationAction from './com/atproto/admin/takeModerationAction'
import searchRepos from './com/atproto/admin/searchRepos'
import getRecord from './com/atproto/admin/getRecord'
import getRepo from './com/atproto/admin/getRepo'
import getModerationAction from './com/atproto/admin/getModerationAction'
import getModerationActions from './com/atproto/admin/getModerationActions'
import getModerationReport from './com/atproto/admin/getModerationReport'
import getModerationReports from './com/atproto/admin/getModerationReports'
import resolveHandle from './com/atproto/identity/resolveHandle'

export * as health from './health'

export * as blobResolver from './blob-resolver'

export default function (server: Server, ctx: AppContext) {
  // app.bsky
  getTimeline(server, ctx)
  getAuthorFeed(server, ctx)
  getLikes(server, ctx)
  getPostThread(server, ctx)
  getPosts(server, ctx)
  getProfile(server, ctx)
  getProfiles(server, ctx)
  getRepostedBy(server, ctx)
  getFollowers(server, ctx)
  getFollows(server, ctx)
  searchActors(server, ctx)
  searchActorsTypeahead(server, ctx)
  getSuggestions(server, ctx)
  getUnreadCount(server, ctx)
  listNotifications(server, ctx)
  unspecced(server, ctx)
  // com.atproto
  createReport(server, ctx)
  resolveModerationReports(server, ctx)
  reverseModerationAction(server, ctx)
  takeModerationAction(server, ctx)
  searchRepos(server, ctx)
  getRecord(server, ctx)
  getRepo(server, ctx)
  getModerationAction(server, ctx)
  getModerationActions(server, ctx)
  getModerationReport(server, ctx)
  getModerationReports(server, ctx)
  resolveHandle(server, ctx)
  return server
}
