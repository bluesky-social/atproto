/**
* GENERATED CODE - DO NOT MODIFY
* Created Mon Sep 19 2022
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
import * as TodoSocialGetFeedView from './types/todo/social/getFeedView'
import * as TodoSocialGetLikedByView from './types/todo/social/getLikedByView'
import * as TodoSocialGetNotificationsView from './types/todo/social/getNotificationsView'
import * as TodoSocialGetPostThreadView from './types/todo/social/getPostThreadView'
import * as TodoSocialGetProfileView from './types/todo/social/getProfileView'
import * as TodoSocialGetRepostedByView from './types/todo/social/getRepostedByView'
import * as TodoSocialGetUserFollowersView from './types/todo/social/getUserFollowersView'
import * as TodoSocialGetUserFollowsView from './types/todo/social/getUserFollowsView'

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

  getFeedView(handler: TodoSocialGetFeedView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getFeedView', handler)
  }

  getLikedByView(handler: TodoSocialGetLikedByView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getLikedByView', handler)
  }

  getNotificationsView(handler: TodoSocialGetNotificationsView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getNotificationsView', handler)
  }

  getPostThreadView(handler: TodoSocialGetPostThreadView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getPostThreadView', handler)
  }

  getProfileView(handler: TodoSocialGetProfileView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getProfileView', handler)
  }

  getRepostedByView(handler: TodoSocialGetRepostedByView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getRepostedByView', handler)
  }

  getUserFollowersView(handler: TodoSocialGetUserFollowersView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getUserFollowersView', handler)
  }

  getUserFollowsView(handler: TodoSocialGetUserFollowsView.Handler) {
    /** @ts-ignore */
    return this.server.xrpc.method('todo.social.getUserFollowsView', handler)
  }
}
