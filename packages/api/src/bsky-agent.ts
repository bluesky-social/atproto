import { AtUri } from '@atproto/uri'
import { AtpAgent } from './agent'
import {
  AppBskyFeedPost,
  AppBskyActorProfile,
  ComAtprotoRepoPutRecord,
} from './client'

export class BskyAgent extends AtpAgent {
  get app() {
    return this.api.app
  }

  getTimeline: typeof this.api.app.bsky.feed.getTimeline = (params, opts) =>
    this.api.app.bsky.feed.getTimeline(params, opts)

  getAuthorFeed: typeof this.api.app.bsky.feed.getAuthorFeed = (params, opts) =>
    this.api.app.bsky.feed.getAuthorFeed(params, opts)

  getPostThread: typeof this.api.app.bsky.feed.getPostThread = (params, opts) =>
    this.api.app.bsky.feed.getPostThread(params, opts)

  getPost: typeof this.api.app.bsky.feed.post.get = (params) =>
    this.api.app.bsky.feed.post.get(params)

  getLikes: typeof this.api.app.bsky.feed.getLikes = (params, opts) =>
    this.api.app.bsky.feed.getLikes(params, opts)

  getRepostedBy: typeof this.api.app.bsky.feed.getRepostedBy = (params, opts) =>
    this.api.app.bsky.feed.getRepostedBy(params, opts)

  getFollows: typeof this.api.app.bsky.graph.getFollows = (params, opts) =>
    this.api.app.bsky.graph.getFollows(params, opts)

  getFollowers: typeof this.api.app.bsky.graph.getFollowers = (params, opts) =>
    this.api.app.bsky.graph.getFollowers(params, opts)

  getProfile: typeof this.api.app.bsky.actor.getProfile = (params, opts) =>
    this.api.app.bsky.actor.getProfile(params, opts)

  getProfiles: typeof this.api.app.bsky.actor.getProfiles = (params, opts) =>
    this.api.app.bsky.actor.getProfiles(params, opts)

  searchActors: typeof this.api.app.bsky.actor.searchActors = (params, opts) =>
    this.api.app.bsky.actor.searchActors(params, opts)

  searchActorsTypeahead: typeof this.api.app.bsky.actor.searchActorsTypeahead =
    (params, opts) =>
      this.api.app.bsky.actor.searchActorsTypeahead(params, opts)

  listNotifications: typeof this.api.app.bsky.notification.listNotifications = (
    params,
    opts,
  ) => this.api.app.bsky.notification.listNotifications(params, opts)

  countUnreadNotifications: typeof this.api.app.bsky.notification.getUnreadCount =
    (params, opts) =>
      this.api.app.bsky.notification.getUnreadCount(params, opts)

  async post(
    record: Partial<AppBskyFeedPost.Record> &
      Omit<AppBskyFeedPost.Record, 'createdAt'>,
  ) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    record.createdAt = record.createdAt || new Date().toISOString()
    return this.api.app.bsky.feed.post.create(
      { repo: this.session.did },
      record as AppBskyFeedPost.Record,
    )
  }

  async deletePost(postUri: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    const postUrip = new AtUri(postUri)
    return await this.api.app.bsky.feed.post.delete({
      repo: postUrip.hostname,
      rkey: postUrip.rkey,
    })
  }

  async like(uri: string, cid: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    return await this.api.app.bsky.feed.like.create(
      { repo: this.session.did },
      {
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
      },
    )
  }

  async deleteLike(likeUri: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    const likeUrip = new AtUri(likeUri)
    return await this.api.app.bsky.feed.like.delete({
      repo: likeUrip.hostname,
      rkey: likeUrip.rkey,
    })
  }

  async repost(uri: string, cid: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    return await this.api.app.bsky.feed.repost.create(
      { repo: this.session.did },
      {
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
      },
    )
  }

  async deleteRepost(repostUri: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    const repostUrip = new AtUri(repostUri)
    return await this.api.app.bsky.feed.repost.delete({
      repo: repostUrip.hostname,
      rkey: repostUrip.rkey,
    })
  }

  async follow(subjectDid: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    return await this.api.app.bsky.graph.follow.create(
      { repo: this.session.did },
      {
        subject: subjectDid,
        createdAt: new Date().toISOString(),
      },
    )
  }

  async deleteFollow(followUri: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    const followUrip = new AtUri(followUri)
    return await this.api.app.bsky.graph.follow.delete({
      repo: followUrip.hostname,
      rkey: followUrip.rkey,
    })
  }

  async upsertProfile(
    updateFn: (
      existing: AppBskyActorProfile.Record | undefined,
    ) => AppBskyActorProfile.Record | Promise<AppBskyActorProfile.Record>,
  ) {
    if (!this.session) {
      throw new Error('Not logged in')
    }

    let retriesRemaining = 5
    while (retriesRemaining >= 0) {
      // fetch existing
      const existing = await this.com.atproto.repo
        .getRecord({
          repo: this.session.did,
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
        })
        .catch((_) => undefined)

      // run the update
      const updated = await updateFn(existing?.data.value)
      if (updated) {
        updated.$type = 'app.bsky.actor.profile'
      }

      // validate the record
      const validation = AppBskyActorProfile.validateRecord(updated)
      if (!validation.success) {
        throw validation.error
      }

      try {
        // attempt the put
        await this.com.atproto.repo.putRecord({
          repo: this.session.did,
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
          record: updated,
          swapRecord: existing?.data.cid || null,
        })
      } catch (e: unknown) {
        if (
          retriesRemaining > 0 &&
          e instanceof ComAtprotoRepoPutRecord.InvalidSwapError
        ) {
          // try again
          retriesRemaining--
          continue
        } else {
          throw e
        }
      }
      break
    }
  }

  async mute(actor: string) {
    return this.api.app.bsky.graph.muteActor({ actor })
  }

  async unmute(actor: string) {
    return this.api.app.bsky.graph.unmuteActor({ actor })
  }

  async updateSeenNotifications(seenAt?: string) {
    seenAt = seenAt || new Date().toISOString()
    return this.api.app.bsky.notification.updateSeen({
      seenAt,
    })
  }
}
