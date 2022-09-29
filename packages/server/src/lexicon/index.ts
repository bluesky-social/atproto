/**
* GENERATED CODE - DO NOT MODIFY
*/
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
} from '@adxp/xrpc-server'
import { methodSchemas } from './schemas'
import * as TodoAdxCreateAccount from './types/todo/adx/createAccount'
import * as TodoAdxCreateSession from './types/todo/adx/createSession'
import * as TodoAdxDeleteAccount from './types/todo/adx/deleteAccount'
import * as TodoAdxDeleteSession from './types/todo/adx/deleteSession'
import * as TodoAdxGetAccount from './types/todo/adx/getAccount'
import * as TodoAdxGetAccountsConfig from './types/todo/adx/getAccountsConfig'
import * as TodoAdxGetSession from './types/todo/adx/getSession'
import * as TodoAdxRepoBatchWrite from './types/todo/adx/repoBatchWrite'
import * as TodoAdxRepoCreateRecord from './types/todo/adx/repoCreateRecord'
import * as TodoAdxRepoDeleteRecord from './types/todo/adx/repoDeleteRecord'
import * as TodoAdxRepoDescribe from './types/todo/adx/repoDescribe'
import * as TodoAdxRepoGetRecord from './types/todo/adx/repoGetRecord'
import * as TodoAdxRepoListRecords from './types/todo/adx/repoListRecords'
import * as TodoAdxRepoPutRecord from './types/todo/adx/repoPutRecord'
import * as TodoAdxResolveName from './types/todo/adx/resolveName'
import * as TodoAdxSyncGetRepo from './types/todo/adx/syncGetRepo'
import * as TodoAdxSyncGetRoot from './types/todo/adx/syncGetRoot'
import * as TodoAdxSyncUpdateRepo from './types/todo/adx/syncUpdateRepo'
import * as TodoSocialGetFeed from './types/todo/social/getFeed'
import * as TodoSocialGetLikedBy from './types/todo/social/getLikedBy'
import * as TodoSocialGetNotificationCount from './types/todo/social/getNotificationCount'
import * as TodoSocialGetNotifications from './types/todo/social/getNotifications'
import * as TodoSocialGetPostThread from './types/todo/social/getPostThread'
import * as TodoSocialGetProfile from './types/todo/social/getProfile'
import * as TodoSocialGetRepostedBy from './types/todo/social/getRepostedBy'
import * as TodoSocialGetUserFollowers from './types/todo/social/getUserFollowers'
import * as TodoSocialGetUserFollows from './types/todo/social/getUserFollows'
import * as TodoSocialPostNotificationsSeen from './types/todo/social/postNotificationsSeen'

export function createServer(): Server {
  return new Server()
}

export class Server {
  xrpc: XrpcServer = createXrpcServer(methodSchemas)
  todo: TodoNS

  constructor() {
    this.todo = new TodoNS(this)
  }
}

export class TodoNS {
  server: Server
  adx: AdxNS
  social: SocialNS

  constructor(server: Server) {
    this.server = server
    this.adx = new AdxNS(server)
    this.social = new SocialNS(server)
  }
}

export class AdxNS {
  server: Server

  constructor(server: Server) {
    this.server = server
  }

  createAccount(handler: TodoAdxCreateAccount.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.createAccount', handler)
  }

  createSession(handler: TodoAdxCreateSession.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.createSession', handler)
  }

  deleteAccount(handler: TodoAdxDeleteAccount.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.deleteAccount', handler)
  }

  deleteSession(handler: TodoAdxDeleteSession.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.deleteSession', handler)
  }

  getAccount(handler: TodoAdxGetAccount.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.getAccount', handler)
  }

  getAccountsConfig(handler: TodoAdxGetAccountsConfig.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.getAccountsConfig', handler)
  }

  getSession(handler: TodoAdxGetSession.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.getSession', handler)
  }

  repoBatchWrite(handler: TodoAdxRepoBatchWrite.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.repoBatchWrite', handler)
  }

  repoCreateRecord(handler: TodoAdxRepoCreateRecord.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.repoCreateRecord', handler)
  }

  repoDeleteRecord(handler: TodoAdxRepoDeleteRecord.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.repoDeleteRecord', handler)
  }

  repoDescribe(handler: TodoAdxRepoDescribe.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.repoDescribe', handler)
  }

  repoGetRecord(handler: TodoAdxRepoGetRecord.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.repoGetRecord', handler)
  }

  repoListRecords(handler: TodoAdxRepoListRecords.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.repoListRecords', handler)
  }

  repoPutRecord(handler: TodoAdxRepoPutRecord.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.repoPutRecord', handler)
  }

  resolveName(handler: TodoAdxResolveName.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.resolveName', handler)
  }

  syncGetRepo(handler: TodoAdxSyncGetRepo.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.syncGetRepo', handler)
  }

  syncGetRoot(handler: TodoAdxSyncGetRoot.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.syncGetRoot', handler)
  }

  syncUpdateRepo(handler: TodoAdxSyncUpdateRepo.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.adx.syncUpdateRepo', handler)
  }
}

export class SocialNS {
  server: Server

  constructor(server: Server) {
    this.server = server
  }

  getFeed(handler: TodoSocialGetFeed.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getFeed', handler)
  }

  getLikedBy(handler: TodoSocialGetLikedBy.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getLikedBy', handler)
  }

  getNotificationCount(handler: TodoSocialGetNotificationCount.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getNotificationCount', handler)
  }

  getNotifications(handler: TodoSocialGetNotifications.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getNotifications', handler)
  }

  getPostThread(handler: TodoSocialGetPostThread.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getPostThread', handler)
  }

  getProfile(handler: TodoSocialGetProfile.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getProfile', handler)
  }

  getRepostedBy(handler: TodoSocialGetRepostedBy.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getRepostedBy', handler)
  }

  getUserFollowers(handler: TodoSocialGetUserFollowers.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getUserFollowers', handler)
  }

  getUserFollows(handler: TodoSocialGetUserFollows.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getUserFollows', handler)
  }

  postNotificationsSeen(handler: TodoSocialPostNotificationsSeen.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.postNotificationsSeen', handler)
  }
}
