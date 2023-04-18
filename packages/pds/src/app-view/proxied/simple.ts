import { Server } from '../../lexicon'
import AppContext from '../../context'
import { AtpAgent } from '@atproto/api'
import {
  FeedViewPost,
  NotFoundPost,
  ThreadViewPost,
  isReasonRepost,
  isThreadViewPost,
} from '../../lexicon/types/app/bsky/feed/defs'
import { dedupeStrs } from '@atproto/common'

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
      const profile = res.data
      const muted = await ctx.services
        .account(ctx.db)
        .getMute(requester, profile.did)
      profile.viewer ??= {}
      profile.viewer.muted = muted
      return {
        encoding: 'application/json',
        body: profile,
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
      const profiles = res.data.profiles

      const dids = profiles.map((profile) => profile.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const profile of profiles) {
        profile.viewer ??= {}
        profile.viewer.muted = mutes[profile.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          profiles,
        },
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
      const { cursor, actors } = res.data
      const dids = actors.map((actor) => actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      for (const actor of actors) {
        actor.viewer ??= {}
        actor.viewer.muted = mutes[actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          actors,
        },
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

      const { cursor, actors } = res.data
      const dids = actors.map((actor) => actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      for (const actor of actors) {
        actor.viewer ??= {}
        actor.viewer.muted = mutes[actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          actors,
        },
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

      const { actors } = res.data
      const dids = actors.map((actor) => actor.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      for (const actor of actors) {
        actor.viewer ??= {}
        actor.viewer.muted = mutes[actor.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: { actors },
      }
    },
  })

  server.app.bsky.feed.getAuthorFeed({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getAuthorFeed(
        params,
        headers(requester),
      )
      const { cursor, feed } = res.data
      const dids = didsForFeedViewPosts(feed)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processFeedViewPostMutes(feed, mutes, (post) => {
        // eliminate posts by a muted account that have been reposted by account of feed
        return (
          post.reason !== undefined &&
          isReasonRepost(post.reason) &&
          mutes[post.post.author.did] === true
        )
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          feed: hydrated,
        },
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

  server.app.bsky.feed.getPostThread({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getPostThread(
        params,
        headers(requester),
      )
      const { thread } = res.data
      if (!isThreadViewPost(thread)) {
        return {
          encoding: 'application/json',
          body: { thread },
        }
      }

      const dids = isThreadViewPost(thread) ? didsForThread(thread) : []
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processThreadViewMutes(thread, mutes)

      return {
        encoding: 'application/json',
        body: {
          thread: hydrated,
        },
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

      const { cursor, uri, cid, repostedBy } = res.data
      const dids = repostedBy.map((repost) => repost.did)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)

      for (const repost of repostedBy) {
        repost.viewer ??= {}
        repost.viewer.muted = mutes[repost.did] ?? false
      }

      return {
        encoding: 'application/json',
        body: {
          cursor,
          uri,
          cid,
          repostedBy,
        },
      }
    },
  })

  server.app.bsky.feed.getTimeline({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.feed.getTimeline(
        params,
        headers(requester),
      )
      const { cursor, feed } = res.data
      const dids = didsForFeedViewPosts(feed)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processFeedViewPostMutes(feed, mutes, (post) => {
        // remove posts & reposts from muted accounts
        return (
          mutes[post.post.author.did] === true ||
          (post.reason !== undefined &&
            isReasonRepost(post.reason) &&
            mutes[post.reason.by.did]) === true
        )
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          feed: hydrated,
        },
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

  server.app.bsky.unspecced.getPopular({
    auth: ctx.accessVerifier,
    handler: async ({ auth, params }) => {
      const requester = auth.credentials.did
      const res = await agent.api.app.bsky.unspecced.getPopular(
        params,
        headers(requester),
      )
      const { cursor, feed } = res.data
      const dids = didsForFeedViewPosts(feed)
      const mutes = await ctx.services.account(ctx.db).getMutes(requester, dids)
      const hydrated = processFeedViewPostMutes(feed, mutes, (post) => {
        return mutes[post.post.author.did] === true
      })

      return {
        encoding: 'application/json',
        body: {
          cursor,
          feed: hydrated,
        },
      }
    },
  })
}

const didsForFeedViewPosts = (feed: FeedViewPost[]): string[] => {
  const dids: string[] = []
  for (const item of feed) {
    dids.push(item.post.author.did)
    if (item.reply) {
      dids.push(item.reply.parent.author.did)
      dids.push(item.reply.root.author.did)
    }
    if (item.reason && isReasonRepost(item.reason)) {
      dids.push(item.reason.by.did)
    }
  }
  return dedupeStrs(dids)
}

const processFeedViewPostMutes = (
  feed: FeedViewPost[],
  mutes: Record<string, boolean>,
  shouldRemove: (post: FeedViewPost) => boolean,
): FeedViewPost[] => {
  const hydrated: FeedViewPost[] = []
  for (const item of feed) {
    if (shouldRemove(item)) continue
    item.post.author.viewer ??= {}
    item.post.author.viewer.muted = false
    if (item.reply) {
      item.reply.parent.author.viewer ??= {}
      item.reply.parent.author.viewer.muted =
        mutes[item.reply.parent.author.did] ?? false

      item.reply.root.author.viewer ??= {}
      item.reply.root.author.viewer.muted =
        mutes[item.reply.root.author.did] ?? false
    }
    if (item.reason && isReasonRepost(item.reason)) {
      item.reason.by.viewer ??= {}
      item.reason.by.viewer.muted = mutes[item.reason.by.did] ?? false
    }
    hydrated.push(item)
  }
  return hydrated
}

const didsForThread = (thread: ThreadViewPost): string[] => {
  return dedupeStrs(didsForThreadRecurse(thread))
}

const didsForThreadRecurse = (thread: ThreadViewPost): string[] => {
  let forParent: string[] = []
  let forReplies: string[] = []
  if (isThreadViewPost(thread.parent)) {
    forParent = didsForThread(thread.parent)
  }
  if (thread.replies) {
    forReplies = thread.replies
      .map((reply) => (isThreadViewPost(reply) ? didsForThread(reply) : []))
      .flat()
  }
  return [thread.post.author.did, ...forParent, ...forReplies]
}

const processThreadViewMutes = (
  thread: ThreadViewPost,
  mutes: Record<string, boolean>,
): ThreadViewPost => {
  thread.post.author.viewer ??= {}
  thread.post.author.viewer.muted = mutes[thread.post.author.did] ?? false
  if (isThreadViewPost(thread.parent)) {
    processThreadViewMutes(thread.parent, mutes)
  }
  if (thread.replies) {
    for (const reply of thread.replies) {
      if (isThreadViewPost(reply)) {
        processThreadViewMutes(reply, mutes)
      }
    }
  }
  return thread
}
