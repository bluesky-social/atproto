import { Server } from '../lexicon'
import AppContext from '../context'
import { AuthRequiredError } from '@atproto/xrpc-server'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.admin.disableAccountInvites({
    auth: ctx.authVerifier.admin,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.isModerator) {
        throw new AuthRequiredError('not a moderator account')
      }
      await ctx.appviewAgent.api.com.atproto.admin.disableAccountInvites(
        input.body,
        {
          ...(await ctx.appviewAuth()),
          encoding: 'application/json',
        },
      )
    },
  })

  server.com.atproto.admin.disableAccountInvites({
    auth: ctx.authVerifier.admin,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.isModerator) {
        throw new AuthRequiredError('not a moderator account')
      }
      await ctx.appviewAgent.api.com.atproto.admin.disableAccountInvites(
        input.body,
        {
          ...(await ctx.appviewAuth()),
          encoding: 'application/json',
        },
      )
    },
  })

  server.com.atproto.admin.disableAccountInvites({
    auth: ctx.authVerifier.admin,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.isModerator) {
        throw new AuthRequiredError('not a moderator account')
      }
      await ctx.appviewAgent.api.com.atproto.admin.disableAccountInvites(
        input.body,
        {
          ...(await ctx.appviewAuth()),
          encoding: 'application/json',
        },
      )
    },
  })

  server.com.atproto.admin.disableAccountInvites({
    auth: ctx.authVerifier.admin,
    handler: async ({ input, auth }) => {
      if (!auth.credentials.isModerator) {
        throw new AuthRequiredError('not a moderator account')
      }
      await ctx.appviewAgent.api.com.atproto.admin.disableAccountInvites(
        input.body,
        {
          ...(await ctx.appviewAuth()),
          encoding: 'application/json',
        },
      )
    },
  })

  server.app.bsky.actor.getProfile({
    auth: ctx.authVerifier.admin,
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

  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.authVerifier.admin,
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
    auth: ctx.authVerifier.admin,
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

  server.app.bsky.graph.getFollows({
    auth: ctx.authVerifier.admin,
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
    auth: ctx.authVerifier.admin,
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
}
