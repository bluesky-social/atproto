import { Server } from '../lexicon'
import AppContext from '../context'

export default function (server: Server, ctx: AppContext) {
  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.modOrRole,
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
    auth: ctx.authVerifier.modOrRole,
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
    auth: ctx.authVerifier.modOrRole,
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

  server.app.bsky.feed.getPostThread({
    auth: ctx.authVerifier.modOrRole,
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
    auth: ctx.authVerifier.modOrRole,
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
    auth: ctx.authVerifier.modOrRole,
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
    auth: ctx.authVerifier.modOrRole,
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
    auth: ctx.authVerifier.modOrRole,
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
}
