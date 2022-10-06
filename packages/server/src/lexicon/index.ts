/**
* GENERATED CODE - DO NOT MODIFY
*/
import {
  createServer as createXrpcServer,
  Server as XrpcServer,
} from '@adxp/xrpc-server'
import { methodSchemas } from './schemas'
import * as TodoAdxCreateAccount from './types/todo/adx/createAccount'
import * as TodoAdxCreateInviteCode from './types/todo/adx/createInviteCode'
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
import * as TodoAdxRequestAccountPasswordReset from './types/todo/adx/requestAccountPasswordReset'
import * as TodoAdxResetAccountPassword from './types/todo/adx/resetAccountPassword'
import * as TodoAdxResolveName from './types/todo/adx/resolveName'
import * as TodoAdxSyncGetRepo from './types/todo/adx/syncGetRepo'
import * as TodoAdxSyncGetRoot from './types/todo/adx/syncGetRoot'
import * as TodoAdxSyncUpdateRepo from './types/todo/adx/syncUpdateRepo'
import * as TodoSocialGetAuthorFeed from './types/todo/social/getAuthorFeed'
import * as TodoSocialGetHomeFeed from './types/todo/social/getHomeFeed'
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
    const schema = 'todo.adx.createAccount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  createInviteCode(handler: TodoAdxCreateInviteCode.Handler) {
    const schema = 'todo.adx.createInviteCode' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  createSession(handler: TodoAdxCreateSession.Handler) {
    const schema = 'todo.adx.createSession' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  deleteAccount(handler: TodoAdxDeleteAccount.Handler) {
    const schema = 'todo.adx.deleteAccount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  deleteSession(handler: TodoAdxDeleteSession.Handler) {
    const schema = 'todo.adx.deleteSession' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getAccount(handler: TodoAdxGetAccount.Handler) {
    const schema = 'todo.adx.getAccount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getAccountsConfig(handler: TodoAdxGetAccountsConfig.Handler) {
    const schema = 'todo.adx.getAccountsConfig' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getSession(handler: TodoAdxGetSession.Handler) {
    const schema = 'todo.adx.getSession' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoBatchWrite(handler: TodoAdxRepoBatchWrite.Handler) {
    const schema = 'todo.adx.repoBatchWrite' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoCreateRecord(handler: TodoAdxRepoCreateRecord.Handler) {
    const schema = 'todo.adx.repoCreateRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoDeleteRecord(handler: TodoAdxRepoDeleteRecord.Handler) {
    const schema = 'todo.adx.repoDeleteRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoDescribe(handler: TodoAdxRepoDescribe.Handler) {
    const schema = 'todo.adx.repoDescribe' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoGetRecord(handler: TodoAdxRepoGetRecord.Handler) {
    const schema = 'todo.adx.repoGetRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoListRecords(handler: TodoAdxRepoListRecords.Handler) {
    const schema = 'todo.adx.repoListRecords' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  repoPutRecord(handler: TodoAdxRepoPutRecord.Handler) {
    const schema = 'todo.adx.repoPutRecord' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  requestAccountPasswordReset(
    handler: TodoAdxRequestAccountPasswordReset.Handler
  ) {
    const schema = 'todo.adx.requestAccountPasswordReset' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  resetAccountPassword(handler: TodoAdxResetAccountPassword.Handler) {
    const schema = 'todo.adx.resetAccountPassword' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  resolveName(handler: TodoAdxResolveName.Handler) {
    const schema = 'todo.adx.resolveName' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  syncGetRepo(handler: TodoAdxSyncGetRepo.Handler) {
    const schema = 'todo.adx.syncGetRepo' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  syncGetRoot(handler: TodoAdxSyncGetRoot.Handler) {
    const schema = 'todo.adx.syncGetRoot' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  syncUpdateRepo(handler: TodoAdxSyncUpdateRepo.Handler) {
    const schema = 'todo.adx.syncUpdateRepo' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }
}

export class SocialNS {
  server: Server

  constructor(server: Server) {
    this.server = server
  }

  getAuthorFeed(handler: TodoSocialGetAuthorFeed.Handler) {
    const schema = 'todo.social.getAuthorFeed' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getHomeFeed(handler: TodoSocialGetHomeFeed.Handler) {
    const schema = 'todo.social.getHomeFeed' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getLikedBy(handler: TodoSocialGetLikedBy.Handler) {
    const schema = 'todo.social.getLikedBy' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getNotificationCount(handler: TodoSocialGetNotificationCount.Handler) {
    const schema = 'todo.social.getNotificationCount' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getNotifications(handler: TodoSocialGetNotifications.Handler) {
    const schema = 'todo.social.getNotifications' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getPostThread(handler: TodoSocialGetPostThread.Handler) {
    const schema = 'todo.social.getPostThread' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getProfile(handler: TodoSocialGetProfile.Handler) {
    const schema = 'todo.social.getProfile' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getRepostedBy(handler: TodoSocialGetRepostedBy.Handler) {
    const schema = 'todo.social.getRepostedBy' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getUserFollowers(handler: TodoSocialGetUserFollowers.Handler) {
    const schema = 'todo.social.getUserFollowers' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  getUserFollows(handler: TodoSocialGetUserFollows.Handler) {
    const schema = 'todo.social.getUserFollows' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }

  postNotificationsSeen(handler: TodoSocialPostNotificationsSeen.Handler) {
    const schema = 'todo.social.postNotificationsSeen' // @ts-ignore
    return this.server.xrpc.method(schema, handler)
  }
}
