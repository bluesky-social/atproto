/**
* GENERATED CODE - DO NOT MODIFY
*/
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
} from '@adxp/xrpc-server'
import { methodSchemas } from './schemas'
import * as ComAtprotoCreateAccount from './types/com/atproto/createAccount'
import * as ComAtprotoCreateInviteCode from './types/com/atproto/createInviteCode'
import * as ComAtprotoCreateSession from './types/com/atproto/createSession'
import * as ComAtprotoDeleteAccount from './types/com/atproto/deleteAccount'
import * as ComAtprotoDeleteSession from './types/com/atproto/deleteSession'
import * as ComAtprotoGetAccount from './types/com/atproto/getAccount'
import * as ComAtprotoGetAccountsConfig from './types/com/atproto/getAccountsConfig'
import * as ComAtprotoGetSession from './types/com/atproto/getSession'
import * as ComAtprotoRepoBatchWrite from './types/com/atproto/repoBatchWrite'
import * as ComAtprotoRepoCreateRecord from './types/com/atproto/repoCreateRecord'
import * as ComAtprotoRepoDeleteRecord from './types/com/atproto/repoDeleteRecord'
import * as ComAtprotoRepoDescribe from './types/com/atproto/repoDescribe'
import * as ComAtprotoRepoGetRecord from './types/com/atproto/repoGetRecord'
import * as ComAtprotoRepoListRecords from './types/com/atproto/repoListRecords'
import * as ComAtprotoRepoPutRecord from './types/com/atproto/repoPutRecord'
import * as ComAtprotoRequestAccountPasswordReset from './types/com/atproto/requestAccountPasswordReset'
import * as ComAtprotoResetAccountPassword from './types/com/atproto/resetAccountPassword'
import * as ComAtprotoResolveName from './types/com/atproto/resolveName'
import * as ComAtprotoSyncGetRepo from './types/com/atproto/syncGetRepo'
import * as ComAtprotoSyncGetRoot from './types/com/atproto/syncGetRoot'
import * as ComAtprotoSyncUpdateRepo from './types/com/atproto/syncUpdateRepo'
import * as AppBskyGetAuthorFeed from './types/app/bsky/getAuthorFeed'
import * as AppBskyGetHomeFeed from './types/app/bsky/getHomeFeed'
import * as AppBskyGetLikedBy from './types/app/bsky/getLikedBy'
import * as AppBskyGetNotificationCount from './types/app/bsky/getNotificationCount'
import * as AppBskyGetNotifications from './types/app/bsky/getNotifications'
import * as AppBskyGetPostThread from './types/app/bsky/getPostThread'
import * as AppBskyGetProfile from './types/app/bsky/getProfile'
import * as AppBskyGetRepostedBy from './types/app/bsky/getRepostedBy'
import * as AppBskyGetUserFollowers from './types/app/bsky/getUserFollowers'
import * as AppBskyGetUserFollows from './types/app/bsky/getUserFollows'
import * as AppBskyGetUsersSearch from './types/app/bsky/getUsersSearch'
import * as AppBskyGetUsersTypeahead from './types/app/bsky/getUsersTypeahead'
import * as AppBskyPostNotificationsSeen from './types/app/bsky/postNotificationsSeen'

export function createServer(): Server {
  return new Server()
}

export class Server {
  xrpc: XrpcServer = createXrpcServer(methodSchemas)
  com: ComNS
  app: AppNS

  constructor() {
    this.com = new ComNS(this)
    this.app = new AppNS(this)
  }
}

export class ComNS {
  server: Server
  atproto: AtprotoNS

  constructor(server: Server) {
    this.server = server
    this.atproto = new AtprotoNS(server)
  }
}

export class AtprotoNS {
  server: Server

  constructor(server: Server) {
    this.server = server
  }

  createAccount(handler: ComAtprotoCreateAccount.Handler) {
    const schema = 'com.atproto.createAccount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  createInviteCode(handler: ComAtprotoCreateInviteCode.Handler) {
    const schema = 'com.atproto.createInviteCode' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  createSession(handler: ComAtprotoCreateSession.Handler) {
    const schema = 'com.atproto.createSession' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  deleteAccount(handler: ComAtprotoDeleteAccount.Handler) {
    const schema = 'com.atproto.deleteAccount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  deleteSession(handler: ComAtprotoDeleteSession.Handler) {
    const schema = 'com.atproto.deleteSession' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getAccount(handler: ComAtprotoGetAccount.Handler) {
    const schema = 'com.atproto.getAccount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getAccountsConfig(handler: ComAtprotoGetAccountsConfig.Handler) {
    const schema = 'com.atproto.getAccountsConfig' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getSession(handler: ComAtprotoGetSession.Handler) {
    const schema = 'com.atproto.getSession' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoBatchWrite(handler: ComAtprotoRepoBatchWrite.Handler) {
    const schema = 'com.atproto.repoBatchWrite' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoCreateRecord(handler: ComAtprotoRepoCreateRecord.Handler) {
    const schema = 'com.atproto.repoCreateRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoDeleteRecord(handler: ComAtprotoRepoDeleteRecord.Handler) {
    const schema = 'com.atproto.repoDeleteRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoDescribe(handler: ComAtprotoRepoDescribe.Handler) {
    const schema = 'com.atproto.repoDescribe' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoGetRecord(handler: ComAtprotoRepoGetRecord.Handler) {
    const schema = 'com.atproto.repoGetRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoListRecords(handler: ComAtprotoRepoListRecords.Handler) {
    const schema = 'com.atproto.repoListRecords' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoPutRecord(handler: ComAtprotoRepoPutRecord.Handler) {
    const schema = 'com.atproto.repoPutRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  requestAccountPasswordReset(
    handler: ComAtprotoRequestAccountPasswordReset.Handler
  ) {
    const schema = 'com.atproto.requestAccountPasswordReset' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  resetAccountPassword(handler: ComAtprotoResetAccountPassword.Handler) {
    const schema = 'com.atproto.resetAccountPassword' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  resolveName(handler: ComAtprotoResolveName.Handler) {
    const schema = 'com.atproto.resolveName' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  syncGetRepo(handler: ComAtprotoSyncGetRepo.Handler) {
    const schema = 'com.atproto.syncGetRepo' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  syncGetRoot(handler: ComAtprotoSyncGetRoot.Handler) {
    const schema = 'com.atproto.syncGetRoot' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  syncUpdateRepo(handler: ComAtprotoSyncUpdateRepo.Handler) {
    const schema = 'com.atproto.syncUpdateRepo' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }
}

export class AppNS {
  server: Server
  bsky: BskyNS

  constructor(server: Server) {
    this.server = server
    this.bsky = new BskyNS(server)
  }
}

export class BskyNS {
  server: Server

  constructor(server: Server) {
    this.server = server
  }

  getAuthorFeed(handler: AppBskyGetAuthorFeed.Handler) {
    const schema = 'app.bsky.getAuthorFeed' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getHomeFeed(handler: AppBskyGetHomeFeed.Handler) {
    const schema = 'app.bsky.getHomeFeed' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getLikedBy(handler: AppBskyGetLikedBy.Handler) {
    const schema = 'app.bsky.getLikedBy' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getNotificationCount(handler: AppBskyGetNotificationCount.Handler) {
    const schema = 'app.bsky.getNotificationCount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getNotifications(handler: AppBskyGetNotifications.Handler) {
    const schema = 'app.bsky.getNotifications' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getPostThread(handler: AppBskyGetPostThread.Handler) {
    const schema = 'app.bsky.getPostThread' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getProfile(handler: AppBskyGetProfile.Handler) {
    const schema = 'app.bsky.getProfile' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getRepostedBy(handler: AppBskyGetRepostedBy.Handler) {
    const schema = 'app.bsky.getRepostedBy' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getUserFollowers(handler: AppBskyGetUserFollowers.Handler) {
    const schema = 'app.bsky.getUserFollowers' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getUserFollows(handler: AppBskyGetUserFollows.Handler) {
    const schema = 'app.bsky.getUserFollows' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getUsersSearch(handler: AppBskyGetUsersSearch.Handler) {
    const schema = 'app.bsky.getUsersSearch' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getUsersTypeahead(handler: AppBskyGetUsersTypeahead.Handler) {
    const schema = 'app.bsky.getUsersTypeahead' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  postNotificationsSeen(handler: AppBskyPostNotificationsSeen.Handler) {
    const schema = 'app.bsky.postNotificationsSeen' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }
}
