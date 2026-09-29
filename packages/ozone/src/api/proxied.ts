import type { Server } from '@atproto/xrpc-server'
import type { AppContext } from '../context.js'
import { app, com, tools } from '../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(app.bsky.actor.getProfile, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.actor.getProfile,
        request.params,
        await ctx.appviewAuth(app.bsky.actor.getProfile.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.actor.getProfiles, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.actor.getProfiles,
        request.params,
        await ctx.appviewAuth(app.bsky.actor.getProfiles.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.feed.getAuthorFeed, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.feed.getAuthorFeed,
        request.params,
        await ctx.appviewAuth(app.bsky.feed.getAuthorFeed.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.feed.searchPosts, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.feed.searchPosts,
        request.params,
        await ctx.appviewAuth(app.bsky.feed.searchPosts.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.feed.getPostThread, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.feed.getPostThread,
        request.params,
        await ctx.appviewAuth(app.bsky.feed.getPostThread.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.feed.getFeedGenerator, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.feed.getFeedGenerator,
        request.params,
        await ctx.appviewAuth(app.bsky.feed.getFeedGenerator.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.graph.getFollows, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.graph.getFollows,
        request.params,
        await ctx.appviewAuth(app.bsky.graph.getFollows.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.graph.getFollowers, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.graph.getFollowers,
        request.params,
        await ctx.appviewAuth(app.bsky.graph.getFollowers.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.graph.getList, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.graph.getList,
        request.params,
        await ctx.appviewAuth(app.bsky.graph.getList.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.graph.getLists, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.graph.getLists,
        request.params,
        await ctx.appviewAuth(app.bsky.graph.getLists.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(com.atproto.admin.searchAccounts, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsClient) {
        throw new Error('PDS not configured')
      }
      const body = await ctx.pdsClient.call(
        com.atproto.admin.searchAccounts,
        request.params,
        await ctx.pdsAuth(com.atproto.admin.searchAccounts.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(com.atproto.temp.revokeAccountCredentials, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsClient) {
        throw new Error('PDS not configured')
      }
      await ctx.pdsClient.call(
        com.atproto.temp.revokeAccountCredentials,
        request.input
          .body as com.atproto.temp.revokeAccountCredentials.$InputBody,
        await ctx.pdsAuth(com.atproto.temp.revokeAccountCredentials.$lxm),
      )
    },
  })

  server.add(tools.ozone.hosting.getAccountHistory, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsClient) {
        throw new Error('PDS not configured')
      }
      const body = await ctx.pdsClient.call(
        tools.ozone.hosting.getAccountHistory,
        request.params,
        await ctx.pdsAuth(tools.ozone.hosting.getAccountHistory.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(tools.ozone.signature.findRelatedAccounts, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsClient) {
        throw new Error('PDS not configured')
      }
      const body = await ctx.pdsClient.call(
        tools.ozone.signature.findRelatedAccounts,
        request.params,
        await ctx.pdsAuth(tools.ozone.signature.findRelatedAccounts.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(tools.ozone.signature.searchAccounts, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsClient) {
        throw new Error('PDS not configured')
      }
      const body = await ctx.pdsClient.call(
        tools.ozone.signature.searchAccounts,
        request.params,
        await ctx.pdsAuth(tools.ozone.signature.searchAccounts.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(tools.ozone.signature.findCorrelation, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsClient) {
        throw new Error('PDS not configured')
      }
      const body = await ctx.pdsClient.call(
        tools.ozone.signature.findCorrelation,
        request.params,
        await ctx.pdsAuth(tools.ozone.signature.findCorrelation.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.graph.getStarterPack, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.graph.getStarterPack,
        request.params,
        await ctx.appviewAuth(app.bsky.graph.getStarterPack.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.graph.getStarterPacks, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.graph.getStarterPacks,
        request.params,
        await ctx.appviewAuth(app.bsky.graph.getStarterPacks.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.graph.getActorStarterPacks, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.graph.getActorStarterPacks,
        request.params,
        await ctx.appviewAuth(app.bsky.graph.getActorStarterPacks.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.feed.getLikes, {
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.feed.getLikes,
        request.params,
        await ctx.appviewAuth(app.bsky.feed.getLikes.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.feed.getRepostedBy, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.feed.getRepostedBy,
        request.params,
        await ctx.appviewAuth(app.bsky.feed.getRepostedBy.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })

  server.add(app.bsky.actor.searchActorsTypeahead, {
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const body = await ctx.appviewClient.call(
        app.bsky.actor.searchActorsTypeahead,
        request.params,
        await ctx.appviewAuth(app.bsky.actor.searchActorsTypeahead.$lxm),
      )
      return {
        encoding: 'application/json',
        body,
      }
    },
  })
}
