import { Server } from '../../lexicon'
import AppContext from '../../context'
import { AtpAgent } from '@atproto/api'

export default function (server: Server, ctx: AppContext) {
  if (!ctx.cfg.bskyAppViewEndpoint) {
    throw new Error('Could not find bsky appview endpoint')
  }
  const agent = new AtpAgent({ service: ctx.cfg.bskyAppViewEndpoint })

  const headers = (did: string) => {
    return {
      headers: { authorization: `Bearer ${did}` },
    }
  }

  server.app.bsky.actor.getProfile({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getProfile(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.getProfiles({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getProfiles(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.getSuggestions({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.getSuggestions(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.searchActors({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.searchActors(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.actor.searchActorsTypeahead({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.actor.searchActorsTypeahead(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  // @TODO MUTES?
  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getAuthorFeed(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getLikes({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getLikes(
        params,
        headers(requester),
      )

      const { cursor, uri, cid, likes } = res.data
      const dids = likes.map((like) => like.actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const like of likes) {
        like.actor.viewer ??= {}
        like.actor.viewer.muted = mutes[like.actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          uri,
          cid,
          likes,
        },
      }
    },
  })

  // @TODO MUTES?
  server.app.bsky.feed.getPostThread({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getPostThread(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.feed.getRepostedBy({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getRepostedBy(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  // @TODO Mutes
  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getTimeline(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })

  server.app.bsky.graph.getFollowers({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.graph.getFollowers(
        params,
        headers(requester),
      )

      const { cursor, subject, followers } = res.data
      const dids = [subject.did, ...followers.map((follower) => follower.did)]
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const follower of followers) {
        follower.viewer ??= {}
        follower.viewer.muted = mutes[follower.did] ?? false
      }
      subject.viewer ??= {}
      subject.viewer.muted = mutes[subject.did] ?? false

      return {
        encoding: 'application/json',
        body: {
          cursor,
          subject,
          followers,
        },
      }
    },
  })

  server.app.bsky.graph.getFollows({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.graph.getFollows(
        params,
        headers(requester),
      )
      const { cursor, subject, follows } = res.data
      const dids = [subject.did, ...follows.map((follow) => follow.did)]
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const follow of follows) {
        follow.viewer ??= {}
        follow.viewer.muted = mutes[follow.did] ?? false
      }
      subject.viewer ??= {}
      subject.viewer.muted = mutes[subject.did] ?? false

      return {
        encoding: 'application/json',
        body: {
          cursor,
          subject,
          follows,
        },
      }
    },
  })

  // @TODO mutes
  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.unspecced.getPopular(
        params,
        headers(requester),
      )
      return {
        encoding: 'application/json',
        body: res.data,
      }
    },
  })
}
