import { AtUri } from '@atproto/syntax'
import { AtpAgent } from './agent'
import {
  AppBskyFeedPost,
  AppBskyActorProfile,
  AppBskyActorDefs,
  ComAtprotoRepoPutRecord,
} from './client'
import {
  BskyPreferences,
  BskyLabelPreference,
  BskyFeedViewPreference,
  BskyThreadViewPreference,
} from './types'

const FEED_VIEW_PREF_DEFAULTS = {
  hideReplies: false,
  hideRepliesByUnfollowed: false,
  hideRepliesByLikeCount: 0,
  hideReposts: false,
  hideQuotePosts: false,
}
const THREAD_VIEW_PREF_DEFAULTS = {
  sort: 'oldest',
  prioritizeFollowedUsers: true,
}

declare global {
  interface Array<T> {
    findLast(
      predicate: (value: T, index: number, obj: T[]) => unknown,
      thisArg?: any,
    ): T
  }
}

export class BskyAgent extends AtpAgent {
  get app() {
    return this.api.app
  }

  getTimeline: typeof this.api.app.bsky.feed.getTimeline = (params, opts) =>
    this.api.app.bsky.feed.getTimeline(params, opts)

  getAuthorFeed: typeof this.api.app.bsky.feed.getAuthorFeed = (params, opts) =>
    this.api.app.bsky.feed.getAuthorFeed(params, opts)

  getActorLikes: typeof this.api.app.bsky.feed.getActorLikes = (params, opts) =>
    this.api.app.bsky.feed.getActorLikes(params, opts)

  getPostThread: typeof this.api.app.bsky.feed.getPostThread = (params, opts) =>
    this.api.app.bsky.feed.getPostThread(params, opts)

  getPost: typeof this.api.app.bsky.feed.post.get = (params) =>
    this.api.app.bsky.feed.post.get(params)

  getPosts: typeof this.api.app.bsky.feed.getPosts = (params, opts) =>
    this.api.app.bsky.feed.getPosts(params, opts)

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

  getSuggestions: typeof this.api.app.bsky.actor.getSuggestions = (
    params,
    opts,
  ) => this.api.app.bsky.actor.getSuggestions(params, opts)

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

  async muteModList(uri: string) {
    return this.api.app.bsky.graph.muteActorList({
      list: uri,
    })
  }

  async unmuteModList(uri: string) {
    return this.api.app.bsky.graph.unmuteActorList({
      list: uri,
    })
  }

  async blockModList(uri: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    return await this.api.app.bsky.graph.listblock.create(
      { repo: this.session.did },
      {
        subject: uri,
        createdAt: new Date().toISOString(),
      },
    )
  }

  async unblockModList(uri: string) {
    if (!this.session) {
      throw new Error('Not logged in')
    }
    const listInfo = await this.api.app.bsky.graph.getList({
      list: uri,
      limit: 1,
    })
    if (!listInfo.data.list.viewer?.blocked) {
      return
    }
    const { rkey } = new AtUri(listInfo.data.list.viewer.blocked)
    return await this.api.app.bsky.graph.listblock.delete({
      repo: this.session.did,
      rkey,
    })
  }

  async updateSeenNotifications(seenAt?: string) {
    seenAt = seenAt || new Date().toISOString()
    return this.api.app.bsky.notification.updateSeen({
      seenAt,
    })
  }

  async getPreferences(): Promise<BskyPreferences> {
    const prefs: BskyPreferences = {
      feeds: {
        saved: undefined,
        pinned: undefined,
      },
      feedViewPrefs: {
        home: {
          ...FEED_VIEW_PREF_DEFAULTS,
        },
      },
      threadViewPrefs: { ...THREAD_VIEW_PREF_DEFAULTS },
      adultContentEnabled: false,
      contentLabels: {},
      birthDate: undefined,
    }
    const res = await this.app.bsky.actor.getPreferences({})
    for (const pref of res.data.preferences) {
      if (
        AppBskyActorDefs.isAdultContentPref(pref) &&
        AppBskyActorDefs.validateAdultContentPref(pref).success
      ) {
        prefs.adultContentEnabled = pref.enabled
      } else if (
        AppBskyActorDefs.isContentLabelPref(pref) &&
        AppBskyActorDefs.validateAdultContentPref(pref).success
      ) {
        let value = pref.visibility
        if (value === 'show') {
          value = 'ignore'
        }
        if (value === 'ignore' || value === 'warn' || value === 'hide') {
          prefs.contentLabels[pref.label] = value as BskyLabelPreference
        }
      } else if (
        AppBskyActorDefs.isSavedFeedsPref(pref) &&
        AppBskyActorDefs.validateSavedFeedsPref(pref).success
      ) {
        prefs.feeds.saved = pref.saved
        prefs.feeds.pinned = pref.pinned
      } else if (
        AppBskyActorDefs.isPersonalDetailsPref(pref) &&
        AppBskyActorDefs.validatePersonalDetailsPref(pref).success
      ) {
        if (pref.birthDate) {
          prefs.birthDate = new Date(pref.birthDate)
        }
      } else if (
        AppBskyActorDefs.isFeedViewPref(pref) &&
        AppBskyActorDefs.validateFeedViewPref(pref).success
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, feed, ...v } = pref
        prefs.feedViewPrefs[pref.feed] = { ...FEED_VIEW_PREF_DEFAULTS, ...v }
      } else if (
        AppBskyActorDefs.isThreadViewPref(pref) &&
        AppBskyActorDefs.validateThreadViewPref(pref).success
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, ...v } = pref
        prefs.threadViewPrefs = { ...prefs.threadViewPrefs, ...v }
      }
    }
    return prefs
  }

  async setSavedFeeds(saved: string[], pinned: string[]) {
    return updateFeedPreferences(this, () => ({
      saved,
      pinned,
    }))
  }

  async addSavedFeed(v: string) {
    return updateFeedPreferences(this, (saved: string[], pinned: string[]) => ({
      saved: [...saved.filter((uri) => uri !== v), v],
      pinned,
    }))
  }

  async removeSavedFeed(v: string) {
    return updateFeedPreferences(this, (saved: string[], pinned: string[]) => ({
      saved: saved.filter((uri) => uri !== v),
      pinned: pinned.filter((uri) => uri !== v),
    }))
  }

  async addPinnedFeed(v: string) {
    return updateFeedPreferences(this, (saved: string[], pinned: string[]) => ({
      saved: [...saved.filter((uri) => uri !== v), v],
      pinned: [...pinned.filter((uri) => uri !== v), v],
    }))
  }

  async removePinnedFeed(v: string) {
    return updateFeedPreferences(this, (saved: string[], pinned: string[]) => ({
      saved,
      pinned: pinned.filter((uri) => uri !== v),
    }))
  }

  async setAdultContentEnabled(v: boolean) {
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      let adultContentPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isAdultContentPref(pref) &&
          AppBskyActorDefs.validateAdultContentPref(pref).success,
      )
      if (adultContentPref) {
        adultContentPref.enabled = v
      } else {
        adultContentPref = {
          $type: 'app.bsky.actor.defs#adultContentPref',
          enabled: v,
        }
      }
      return prefs
        .filter((pref) => !AppBskyActorDefs.isAdultContentPref(pref))
        .concat([adultContentPref])
    })
  }

  async setContentLabelPref(key: string, value: BskyLabelPreference) {
    // TEMP update old value
    if (value === 'show') {
      value = 'ignore'
    }

    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      let labelPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isContentLabelPref(pref) &&
          AppBskyActorDefs.validateAdultContentPref(pref).success &&
          pref.label === key,
      )
      if (labelPref) {
        labelPref.visibility = value
      } else {
        labelPref = {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: key,
          visibility: value,
        }
      }
      return prefs
        .filter(
          (pref) =>
            !AppBskyActorDefs.isContentLabelPref(pref) || pref.label !== key,
        )
        .concat([labelPref])
    })
  }

  async setPersonalDetails({
    birthDate,
  }: {
    birthDate: string | Date | undefined
  }) {
    birthDate = birthDate instanceof Date ? birthDate.toISOString() : birthDate
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      let personalDetailsPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isPersonalDetailsPref(pref) &&
          AppBskyActorDefs.validatePersonalDetailsPref(pref).success,
      )
      if (personalDetailsPref) {
        personalDetailsPref.birthDate = birthDate
      } else {
        personalDetailsPref = {
          $type: 'app.bsky.actor.defs#personalDetailsPref',
          birthDate,
        }
      }
      return prefs
        .filter((pref) => !AppBskyActorDefs.isPersonalDetailsPref(pref))
        .concat([personalDetailsPref])
    })
  }

  async setFeedViewPrefs(feed: string, pref: Partial<BskyFeedViewPreference>) {
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      const existing = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isFeedViewPref(pref) &&
          AppBskyActorDefs.validateFeedViewPref(pref).success &&
          pref.feed === feed,
      )
      if (existing) {
        pref = { ...existing, ...pref }
      }
      return prefs
        .filter(
          (p) => !AppBskyActorDefs.isFeedViewPref(pref) || p.feed !== feed,
        )
        .concat([{ ...pref, $type: 'app.bsky.actor.defs#feedViewPref', feed }])
    })
  }

  async setThreadViewPrefs(pref: Partial<BskyThreadViewPreference>) {
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      const existing = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isThreadViewPref(pref) &&
          AppBskyActorDefs.validateThreadViewPref(pref).success,
      )
      if (existing) {
        pref = { ...existing, ...pref }
      }
      return prefs
        .filter((p) => !AppBskyActorDefs.isThreadViewPref(p))
        .concat([{ ...pref, $type: 'app.bsky.actor.defs#threadViewPref' }])
    })
  }
}

/**
 * This function updates the preferences of a user and allows for a callback function to be executed
 * before the update.
 * @param cb - cb is a callback function that takes in a single parameter of type
 * AppBskyActorDefs.Preferences and returns either a boolean or void. This callback function is used to
 * update the preferences of the user. The function is called with the current preferences as an
 * argument and if the callback returns false, the preferences are not updated.
 */
async function updatePreferences(
  agent: BskyAgent,
  cb: (
    prefs: AppBskyActorDefs.Preferences,
  ) => AppBskyActorDefs.Preferences | false,
) {
  const res = await agent.app.bsky.actor.getPreferences({})
  const newPrefs = cb(res.data.preferences)
  if (newPrefs === false) {
    return
  }
  await agent.app.bsky.actor.putPreferences({
    preferences: newPrefs,
  })
}

/**
 * A helper specifically for updating feed preferences
 */
async function updateFeedPreferences(
  agent: BskyAgent,
  cb: (
    saved: string[],
    pinned: string[],
  ) => { saved: string[]; pinned: string[] },
): Promise<{ saved: string[]; pinned: string[] }> {
  let res
  await updatePreferences(agent, (prefs: AppBskyActorDefs.Preferences) => {
    let feedsPref = prefs.findLast(
      (pref) =>
        AppBskyActorDefs.isSavedFeedsPref(pref) &&
        AppBskyActorDefs.validateSavedFeedsPref(pref).success,
    ) as AppBskyActorDefs.SavedFeedsPref | undefined
    if (feedsPref) {
      res = cb(feedsPref.saved, feedsPref.pinned)
      feedsPref.saved = res.saved
      feedsPref.pinned = res.pinned
    } else {
      res = cb([], [])
      feedsPref = {
        $type: 'app.bsky.actor.defs#savedFeedsPref',
        saved: res.saved,
        pinned: res.pinned,
      }
    }
    return prefs
      .filter((pref) => !AppBskyActorDefs.isSavedFeedsPref(pref))
      .concat([feedsPref])
  })
  return res
}
