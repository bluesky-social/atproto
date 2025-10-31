import { AppContext } from '../context'
import { Server } from '../lexicon'
import { ids } from '../lexicon/lexicons'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.actor.getProfile(
        request.params,
        await ctx.appviewAuth(ids.AppBskyActorGetProfile),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.getProfiles({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.actor.getProfiles(
        request.params,
        await ctx.appviewAuth(ids.AppBskyActorGetProfiles),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.feed.getAuthorFeed(
        request.params,
        await ctx.appviewAuth(ids.AppBskyFeedGetAuthorFeed),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.searchPosts({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.feed.searchPosts(
        request.params,
        await ctx.appviewAuth(ids.AppBskyFeedSearchPosts),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.feed.getPostThread(
        request.params,
        await ctx.appviewAuth(ids.AppBskyFeedGetPostThread),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getFeedGenerator({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.feed.getFeedGenerator(
        request.params,
        await ctx.appviewAuth(ids.AppBskyFeedGetFeedGenerator),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getFollows({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.graph.getFollows(
        request.params,
        await ctx.appviewAuth(ids.AppBskyGraphGetFollows),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getFollowers({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.graph.getFollowers(
        request.params,
        await ctx.appviewAuth(ids.AppBskyGraphGetFollowers),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getList({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.graph.getList(
        request.params,
        await ctx.appviewAuth(ids.AppBskyGraphGetList),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getLists({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.graph.getLists(
        request.params,
        await ctx.appviewAuth(ids.AppBskyGraphGetLists),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.com.atproto.admin.searchAccounts({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsAgent) {
        throw new Error('PDS not configured')
      }
      const res = await ctx.pdsAgent.com.atproto.admin.searchAccounts(
        request.params,
        await ctx.pdsAuth(ids.ComAtprotoAdminSearchAccounts),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.com.atproto.temp.revokeAccountCredentials({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsAgent) {
        throw new Error('PDS not configured')
      }
      await ctx.pdsAgent.com.atproto.temp.revokeAccountCredentials(
        request.input.body,
        await ctx.pdsAuth(ids.ComAtprotoTempRevokeAccountCredentials),
      )
    },
  })

  server.tools.ozone.hosting.getAccountHistory({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsAgent) {
        throw new Error('PDS not configured')
      }
      const res = await ctx.pdsAgent.tools.ozone.hosting.getAccountHistory(
        request.params,
        await ctx.pdsAuth(ids.ToolsOzoneHostingGetAccountHistory),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.tools.ozone.signature.findRelatedAccounts({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsAgent) {
        throw new Error('PDS not configured')
      }
      const res = await ctx.pdsAgent.tools.ozone.signature.findRelatedAccounts(
        request.params,
        await ctx.pdsAuth(ids.ToolsOzoneSignatureFindRelatedAccounts),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.tools.ozone.signature.searchAccounts({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsAgent) {
        throw new Error('PDS not configured')
      }
      const res = await ctx.pdsAgent.tools.ozone.signature.searchAccounts(
        request.params,
        await ctx.pdsAuth(ids.ToolsOzoneSignatureSearchAccounts),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.tools.ozone.signature.findCorrelation({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      if (!ctx.pdsAgent) {
        throw new Error('PDS not configured')
      }
      const res = await ctx.pdsAgent.tools.ozone.signature.findCorrelation(
        request.params,
        await ctx.pdsAuth(ids.ToolsOzoneSignatureFindCorrelation),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getStarterPack({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.graph.getStarterPack(
        request.params,
        await ctx.appviewAuth(ids.AppBskyGraphGetStarterPack),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getStarterPacks({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.graph.getStarterPacks(
        request.params,
        await ctx.appviewAuth(ids.AppBskyGraphGetStarterPacks),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getActorStarterPacks({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.graph.getActorStarterPacks(
        request.params,
        await ctx.appviewAuth(ids.AppBskyGraphGetActorStarterPacks),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getLikes({
    auth: ctx.authVerifier.modOrAdminToken,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.feed.getLikes(
        request.params,
        await ctx.appviewAuth(ids.AppBskyFeedGetLikes),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getRepostedBy({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.feed.getRepostedBy(
        request.params,
        await ctx.appviewAuth(ids.AppBskyFeedGetRepostedBy),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.app.bsky.actor.searchActorsTypeahead(
        request.params,
        await ctx.appviewAuth(ids.AppBskyActorSearchActorsTypeahead),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
