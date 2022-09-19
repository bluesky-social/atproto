/**
* GENERATED CODE - DO NOT MODIFY
* Created Mon Sep 19 2022
*/
import { Client as XrpcClient } from '@adxp/xrpc'
import { schemas } from './schemas'
import * as TodoAdxCreateAccount from './types/todo.adx.createAccount'
import * as TodoAdxCreateSession from './types/todo.adx.createSession'
import * as TodoAdxDeleteAccount from './types/todo.adx.deleteAccount'
import * as TodoAdxDeleteSession from './types/todo.adx.deleteSession'
import * as TodoAdxGetAccount from './types/todo.adx.getAccount'
import * as TodoAdxGetSession from './types/todo.adx.getSession'
import * as TodoAdxRepoBatchWrite from './types/todo.adx.repoBatchWrite'
import * as TodoAdxRepoCreateRecord from './types/todo.adx.repoCreateRecord'
import * as TodoAdxRepoDeleteRecord from './types/todo.adx.repoDeleteRecord'
import * as TodoAdxRepoDescribe from './types/todo.adx.repoDescribe'
import * as TodoAdxRepoGetRecord from './types/todo.adx.repoGetRecord'
import * as TodoAdxRepoListRecords from './types/todo.adx.repoListRecords'
import * as TodoAdxRepoPutRecord from './types/todo.adx.repoPutRecord'
import * as TodoAdxResolveName from './types/todo.adx.resolveName'
import * as TodoAdxSyncGetRepo from './types/todo.adx.syncGetRepo'
import * as TodoAdxSyncGetRoot from './types/todo.adx.syncGetRoot'
import * as TodoAdxSyncUpdateRepo from './types/todo.adx.syncUpdateRepo'

export class API {
  xrpc: XrpcClient = new XrpcClient()
  todo: TodoNS

  constructor() {
    this.xrpc.addSchemas(schemas)
    this.todo = new TodoNS(this)
  }
}

export class TodoNS {
  api: API
  adx: AdxNS

  constructor(api: API) {
    this.api = api
    this.adx = new AdxNS(api)
  }
}

export class AdxNS {
  api: API

  constructor(api: API) {
    this.api = api
  }

  createAccount(
    serviceUri: string,
    params?: TodoAdxCreateAccount.QueryParams,
    opts?: TodoAdxCreateAccount.CallOptions
  ): Promise<TodoAdxCreateAccount.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.createAccount',
      params,
      opts
    )
  }

  createSession(
    serviceUri: string,
    params?: TodoAdxCreateSession.QueryParams,
    opts?: TodoAdxCreateSession.CallOptions
  ): Promise<TodoAdxCreateSession.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.createSession',
      params,
      opts
    )
  }

  deleteAccount(
    serviceUri: string,
    params?: TodoAdxDeleteAccount.QueryParams,
    opts?: TodoAdxDeleteAccount.CallOptions
  ): Promise<TodoAdxDeleteAccount.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.deleteAccount',
      params,
      opts
    )
  }

  deleteSession(
    serviceUri: string,
    params?: TodoAdxDeleteSession.QueryParams,
    opts?: TodoAdxDeleteSession.CallOptions
  ): Promise<TodoAdxDeleteSession.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.deleteSession',
      params,
      opts
    )
  }

  getAccount(
    serviceUri: string,
    params?: TodoAdxGetAccount.QueryParams,
    opts?: TodoAdxGetAccount.CallOptions
  ): Promise<TodoAdxGetAccount.Response> {
    return this.api.xrpc.call(serviceUri, 'todo.adx.getAccount', params, opts)
  }

  getSession(
    serviceUri: string,
    params?: TodoAdxGetSession.QueryParams,
    opts?: TodoAdxGetSession.CallOptions
  ): Promise<TodoAdxGetSession.Response> {
    return this.api.xrpc.call(serviceUri, 'todo.adx.getSession', params, opts)
  }

  repoBatchWrite(
    serviceUri: string,
    params?: TodoAdxRepoBatchWrite.QueryParams,
    opts?: TodoAdxRepoBatchWrite.CallOptions
  ): Promise<TodoAdxRepoBatchWrite.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoBatchWrite',
      params,
      opts
    )
  }

  repoCreateRecord(
    serviceUri: string,
    params?: TodoAdxRepoCreateRecord.QueryParams,
    opts?: TodoAdxRepoCreateRecord.CallOptions
  ): Promise<TodoAdxRepoCreateRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoCreateRecord',
      params,
      opts
    )
  }

  repoDeleteRecord(
    serviceUri: string,
    params?: TodoAdxRepoDeleteRecord.QueryParams,
    opts?: TodoAdxRepoDeleteRecord.CallOptions
  ): Promise<TodoAdxRepoDeleteRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoDeleteRecord',
      params,
      opts
    )
  }

  repoDescribe(
    serviceUri: string,
    params?: TodoAdxRepoDescribe.QueryParams,
    opts?: TodoAdxRepoDescribe.CallOptions
  ): Promise<TodoAdxRepoDescribe.Response> {
    return this.api.xrpc.call(serviceUri, 'todo.adx.repoDescribe', params, opts)
  }

  repoGetRecord(
    serviceUri: string,
    params?: TodoAdxRepoGetRecord.QueryParams,
    opts?: TodoAdxRepoGetRecord.CallOptions
  ): Promise<TodoAdxRepoGetRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoGetRecord',
      params,
      opts
    )
  }

  repoListRecords(
    serviceUri: string,
    params?: TodoAdxRepoListRecords.QueryParams,
    opts?: TodoAdxRepoListRecords.CallOptions
  ): Promise<TodoAdxRepoListRecords.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoListRecords',
      params,
      opts
    )
  }

  repoPutRecord(
    serviceUri: string,
    params?: TodoAdxRepoPutRecord.QueryParams,
    opts?: TodoAdxRepoPutRecord.CallOptions
  ): Promise<TodoAdxRepoPutRecord.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.repoPutRecord',
      params,
      opts
    )
  }

  resolveName(
    serviceUri: string,
    params?: TodoAdxResolveName.QueryParams,
    opts?: TodoAdxResolveName.CallOptions
  ): Promise<TodoAdxResolveName.Response> {
    return this.api.xrpc.call(serviceUri, 'todo.adx.resolveName', params, opts)
  }

  syncGetRepo(
    serviceUri: string,
    params?: TodoAdxSyncGetRepo.QueryParams,
    opts?: TodoAdxSyncGetRepo.CallOptions
  ): Promise<TodoAdxSyncGetRepo.Response> {
    return this.api.xrpc.call(serviceUri, 'todo.adx.syncGetRepo', params, opts)
  }

  syncGetRoot(
    serviceUri: string,
    params?: TodoAdxSyncGetRoot.QueryParams,
    opts?: TodoAdxSyncGetRoot.CallOptions
  ): Promise<TodoAdxSyncGetRoot.Response> {
    return this.api.xrpc.call(serviceUri, 'todo.adx.syncGetRoot', params, opts)
  }

  syncUpdateRepo(
    serviceUri: string,
    params?: TodoAdxSyncUpdateRepo.QueryParams,
    opts?: TodoAdxSyncUpdateRepo.CallOptions
  ): Promise<TodoAdxSyncUpdateRepo.Response> {
    return this.api.xrpc.call(
      serviceUri,
      'todo.adx.syncUpdateRepo',
      params,
      opts
    )
  }
}
