import { Server } from '../lexicon'
import AppContext from '../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.actor.getProfile(
        request.params,
        await ctx.appviewAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.getProfiles({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.actor.getProfiles(
        request.params,
        await ctx.appviewAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.feed.getAuthorFeed(
        request.params,
        await ctx.appviewAuth(),
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
      const res = await ctx.appviewAgent.api.app.bsky.feed.searchPosts(
        request.params,
        await ctx.appviewAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.feed.getPostThread(
        request.params,
        await ctx.appviewAuth(),
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
      const res = await ctx.appviewAgent.api.app.bsky.feed.getFeedGenerator(
        request.params,
        await ctx.appviewAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getFollows({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.graph.getFollows(
        request.params,
        await ctx.appviewAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getFollowers({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.graph.getFollowers(
        request.params,
        await ctx.appviewAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getList({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.graph.getList(
        request.params,
        await ctx.appviewAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getLists({
    auth: ctx.authVerifier.moderator,
    handler: async (request) => {
      const res = await ctx.appviewAgent.api.app.bsky.graph.getLists(
        request.params,
        await ctx.appviewAuth(),
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
      const res = await ctx.pdsAgent.api.com.atproto.admin.searchAccounts(
        request.params,
        await ctx.pdsAuth(),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
