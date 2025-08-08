/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type Auth,
  type Options as XrpcOptions,
  Server as XrpcServer,
  type StreamConfigOrHandler,
  type MethodConfigOrHandler,
  createServer as createXrpcServer,
} from '@atproto/xrpc-server'
import * as AppBskyNotificationDeclaration from '../../../../types/app/bsky/notification/declaration.js'
import * as AppBskyNotificationGetPreferences from '../../../../types/app/bsky/notification/getPreferences.js'
import * as AppBskyNotificationGetUnreadCount from '../../../../types/app/bsky/notification/getUnreadCount.js'
import * as AppBskyNotificationListActivitySubscriptions from '../../../../types/app/bsky/notification/listActivitySubscriptions.js'
import * as AppBskyNotificationListNotifications from '../../../../types/app/bsky/notification/listNotifications.js'
import * as AppBskyNotificationPutActivitySubscription from '../../../../types/app/bsky/notification/putActivitySubscription.js'
import * as AppBskyNotificationPutPreferences from '../../../../types/app/bsky/notification/putPreferences.js'
import * as AppBskyNotificationPutPreferencesV2 from '../../../../types/app/bsky/notification/putPreferencesV2.js'
import * as AppBskyNotificationRegisterPush from '../../../../types/app/bsky/notification/registerPush.js'
import * as AppBskyNotificationUnregisterPush from '../../../../types/app/bsky/notification/unregisterPush.js'
import * as AppBskyNotificationUpdateSeen from '../../../../types/app/bsky/notification/updateSeen.js'
import { Server } from '../../../../index.js'

export class AppBskyNotificationNS {
  _server: Server

  constructor(server: Server) {
    this._server = server
  }

  getPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationGetPreferences.QueryParams,
      AppBskyNotificationGetPreferences.HandlerInput,
      AppBskyNotificationGetPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.getPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  getUnreadCount<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationGetUnreadCount.QueryParams,
      AppBskyNotificationGetUnreadCount.HandlerInput,
      AppBskyNotificationGetUnreadCount.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.getUnreadCount' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listActivitySubscriptions<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationListActivitySubscriptions.QueryParams,
      AppBskyNotificationListActivitySubscriptions.HandlerInput,
      AppBskyNotificationListActivitySubscriptions.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.listActivitySubscriptions' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  listNotifications<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationListNotifications.QueryParams,
      AppBskyNotificationListNotifications.HandlerInput,
      AppBskyNotificationListNotifications.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.listNotifications' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putActivitySubscription<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationPutActivitySubscription.QueryParams,
      AppBskyNotificationPutActivitySubscription.HandlerInput,
      AppBskyNotificationPutActivitySubscription.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.putActivitySubscription' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putPreferences<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationPutPreferences.QueryParams,
      AppBskyNotificationPutPreferences.HandlerInput,
      AppBskyNotificationPutPreferences.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.putPreferences' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  putPreferencesV2<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationPutPreferencesV2.QueryParams,
      AppBskyNotificationPutPreferencesV2.HandlerInput,
      AppBskyNotificationPutPreferencesV2.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.putPreferencesV2' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  registerPush<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationRegisterPush.QueryParams,
      AppBskyNotificationRegisterPush.HandlerInput,
      AppBskyNotificationRegisterPush.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.registerPush' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  unregisterPush<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationUnregisterPush.QueryParams,
      AppBskyNotificationUnregisterPush.HandlerInput,
      AppBskyNotificationUnregisterPush.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.unregisterPush' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }

  updateSeen<A extends Auth = void>(
    cfg: MethodConfigOrHandler<
      A,
      AppBskyNotificationUpdateSeen.QueryParams,
      AppBskyNotificationUpdateSeen.HandlerInput,
      AppBskyNotificationUpdateSeen.HandlerOutput
    >,
  ) {
    const nsid = 'app.bsky.notification.updateSeen' // @ts-ignore
    return this._server.xrpc.method(nsid, cfg)
  }
}
