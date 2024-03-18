import { AtUri, ensureValidDid } from '@atproto/syntax'
import { AtpAgent } from './agent'
import {
  AppBskyFeedPost,
  AppBskyActorProfile,
  AppBskyActorDefs,
  AppBskyLabelerDefs,
  ComAtprotoRepoPutRecord,
} from './client'
import {
  BskyPreferences,
  BskyFeedViewPreference,
  BskyThreadViewPreference,
  BskyInterestsPreference,
} from './types'
import {
  InterpretedLabelValueDefinition,
  LabelPreference,
  ModerationPrefs,
} from './moderation/types'
import { DEFAULT_LABEL_SETTINGS } from './moderation/const/labels'
import { sanitizeMutedWordValue } from './util'
import { interpretLabelValueDefinitions } from './moderation'

const FEED_VIEW_PREF_DEFAULTS = {
  hideReplies: false,
  hideRepliesByUnfollowed: true,
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
  clone() {
    const inst = new BskyAgent({
      service: this.service,
    })
    this.copyInto(inst)
    return inst
  }

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

  getLabelers: typeof this.api.app.bsky.labeler.getServices = (params, opts) =>
    this.api.app.bsky.labeler.getServices(params, opts)

  async getLabelDefinitions(
    prefs: BskyPreferences | ModerationPrefs | string[],
  ): Promise<Record<string, InterpretedLabelValueDefinition[]>> {
    // collect the labeler dids
    let dids: string[] = BskyAgent.appLabelers
    if (isBskyPrefs(prefs)) {
      dids = dids.concat(prefs.moderationPrefs.labelers.map((l) => l.did))
    } else if (isModPrefs(prefs)) {
      dids = dids.concat(prefs.labelers.map((l) => l.did))
    } else {
      dids = dids.concat(prefs)
    }

    // fetch their definitions
    const labelers = await this.getLabelers({
      dids,
      detailed: true,
    })

    // assemble a map of labeler dids to the interpretted label value definitions
    const labelDefs = {}
    if (labelers.data) {
      for (const labeler of labelers.data
        .views as AppBskyLabelerDefs.LabelerViewDetailed[]) {
        labelDefs[labeler.creator.did] = interpretLabelValueDefinitions(labeler)
      }
    }

    return labelDefs
  }

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
      moderationPrefs: {
        adultContentEnabled: false,
        labels: { ...DEFAULT_LABEL_SETTINGS },
        labelers: BskyAgent.appLabelers.map((did) => ({ did, labels: {} })),
        mutedWords: [],
        hiddenPosts: [],
      },
      birthDate: undefined,
      interests: {
        tags: [],
      },
    }
    const res = await this.app.bsky.actor.getPreferences({})
    const labelPrefs: AppBskyActorDefs.ContentLabelPref[] = []
    for (const pref of res.data.preferences) {
      if (
        AppBskyActorDefs.isAdultContentPref(pref) &&
        AppBskyActorDefs.validateAdultContentPref(pref).success
      ) {
        // adult content preferences
        prefs.moderationPrefs.adultContentEnabled = pref.enabled
      } else if (
        AppBskyActorDefs.isContentLabelPref(pref) &&
        AppBskyActorDefs.validateContentLabelPref(pref).success
      ) {
        // content label preference
        const adjustedPref = adjustLegacyContentLabelPref(pref)
        labelPrefs.push(adjustedPref)
      } else if (
        AppBskyActorDefs.isLabelersPref(pref) &&
        AppBskyActorDefs.validateLabelersPref(pref).success
      ) {
        // labelers preferences
        prefs.moderationPrefs.labelers = BskyAgent.appLabelers
          .map((did) => ({ did, labels: {} }))
          .concat(
            pref.labelers.map((labeler) => ({
              ...labeler,
              labels: {},
            })),
          )
      } else if (
        AppBskyActorDefs.isSavedFeedsPref(pref) &&
        AppBskyActorDefs.validateSavedFeedsPref(pref).success
      ) {
        // saved and pinned feeds
        prefs.feeds.saved = pref.saved
        prefs.feeds.pinned = pref.pinned
      } else if (
        AppBskyActorDefs.isPersonalDetailsPref(pref) &&
        AppBskyActorDefs.validatePersonalDetailsPref(pref).success
      ) {
        // birth date (irl)
        if (pref.birthDate) {
          prefs.birthDate = new Date(pref.birthDate)
        }
      } else if (
        AppBskyActorDefs.isFeedViewPref(pref) &&
        AppBskyActorDefs.validateFeedViewPref(pref).success
      ) {
        // feed view preferences
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, feed, ...v } = pref
        prefs.feedViewPrefs[pref.feed] = { ...FEED_VIEW_PREF_DEFAULTS, ...v }
      } else if (
        AppBskyActorDefs.isThreadViewPref(pref) &&
        AppBskyActorDefs.validateThreadViewPref(pref).success
      ) {
        // thread view preferences
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, ...v } = pref
        prefs.threadViewPrefs = { ...prefs.threadViewPrefs, ...v }
      } else if (
        AppBskyActorDefs.isInterestsPref(pref) &&
        AppBskyActorDefs.validateInterestsPref(pref).success
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, ...v } = pref
        prefs.interests = { ...prefs.interests, ...v }
      } else if (
        AppBskyActorDefs.isMutedWordsPref(pref) &&
        AppBskyActorDefs.validateMutedWordsPref(pref).success
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, ...v } = pref
        prefs.moderationPrefs.mutedWords = v.items
      } else if (
        AppBskyActorDefs.isHiddenPostsPref(pref) &&
        AppBskyActorDefs.validateHiddenPostsPref(pref).success
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, ...v } = pref
        prefs.moderationPrefs.hiddenPosts = v.items
      }
    }

    // apply the label prefs
    for (const pref of labelPrefs) {
      if (pref.labelerDid) {
        const labeler = prefs.moderationPrefs.labelers.find(
          (labeler) => labeler.did === pref.labelerDid,
        )
        if (!labeler) continue
        labeler.labels[pref.label] = pref.visibility as LabelPreference
      } else {
        prefs.moderationPrefs.labels[pref.label] =
          pref.visibility as LabelPreference
      }
    }

    prefs.moderationPrefs.labels = remapLegacyLabels(
      prefs.moderationPrefs.labels,
    )

    // automatically configure the client
    this.configureLabelersHeader(prefsArrayToLabelerDids(res.data.preferences))

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

  async setContentLabelPref(
    key: string,
    value: LabelPreference,
    labelerDid?: string,
  ) {
    if (labelerDid) {
      ensureValidDid(labelerDid)
    }
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      let labelPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isContentLabelPref(pref) &&
          AppBskyActorDefs.validateContentLabelPref(pref).success &&
          pref.label === key &&
          pref.labelerDid === labelerDid,
      )
      let legacyLabelPref: AppBskyActorDefs.ContentLabelPref | undefined

      if (labelPref) {
        labelPref.visibility = value
      } else {
        labelPref = {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: key,
          labelerDid,
          visibility: value,
        }
      }

      if (AppBskyActorDefs.isContentLabelPref(labelPref)) {
        // is global
        if (!labelPref.labelerDid) {
          const legacyLabelValue = {
            'graphic-media': 'gore',
            porn: 'nsfw',
            sexual: 'suggestive',
          }[labelPref.label]

          // if it's a legacy label, double-write the legacy label
          if (legacyLabelValue) {
            legacyLabelPref = prefs.findLast(
              (pref) =>
                AppBskyActorDefs.isContentLabelPref(pref) &&
                AppBskyActorDefs.validateContentLabelPref(pref).success &&
                pref.label === legacyLabelValue &&
                pref.labelerDid === undefined,
            ) as AppBskyActorDefs.ContentLabelPref | undefined

            if (legacyLabelPref) {
              legacyLabelPref.visibility = value
            } else {
              legacyLabelPref = {
                $type: 'app.bsky.actor.defs#contentLabelPref',
                label: legacyLabelValue,
                labelerDid: undefined,
                visibility: value,
              }
            }
          }
        }
      }

      return prefs
        .filter(
          (pref) =>
            !AppBskyActorDefs.isContentLabelPref(pref) ||
            !(pref.label === key && pref.labelerDid === labelerDid),
        )
        .concat([labelPref])
        .filter((pref) => {
          if (!legacyLabelPref) return true
          return (
            !AppBskyActorDefs.isContentLabelPref(pref) ||
            !(
              pref.label === legacyLabelPref.label &&
              pref.labelerDid === undefined
            )
          )
        })
        .concat(legacyLabelPref ? [legacyLabelPref] : [])
    })
  }

  async addLabeler(did: string) {
    const prefs = await updatePreferences(
      this,
      (prefs: AppBskyActorDefs.Preferences) => {
        let labelersPref = prefs.findLast(
          (pref) =>
            AppBskyActorDefs.isLabelersPref(pref) &&
            AppBskyActorDefs.validateLabelersPref(pref).success,
        )
        if (!labelersPref) {
          labelersPref = {
            $type: 'app.bsky.actor.defs#labelersPref',
            labelers: [],
          }
        }
        if (AppBskyActorDefs.isLabelersPref(labelersPref)) {
          let labelerPrefItem = labelersPref.labelers.find(
            (labeler) => labeler.did === did,
          )
          if (!labelerPrefItem) {
            labelerPrefItem = {
              did,
            }
            labelersPref.labelers.push(labelerPrefItem)
          }
        }
        return prefs
          .filter((pref) => !AppBskyActorDefs.isLabelersPref(pref))
          .concat([labelersPref])
      },
    )
    // automatically configure the client
    this.configureLabelersHeader(prefsArrayToLabelerDids(prefs))
  }

  async removeLabeler(did: string) {
    const prefs = await updatePreferences(
      this,
      (prefs: AppBskyActorDefs.Preferences) => {
        let labelersPref = prefs.findLast(
          (pref) =>
            AppBskyActorDefs.isLabelersPref(pref) &&
            AppBskyActorDefs.validateLabelersPref(pref).success,
        )
        if (!labelersPref) {
          labelersPref = {
            $type: 'app.bsky.actor.defs#labelersPref',
            labelers: [],
          }
        }
        if (AppBskyActorDefs.isLabelersPref(labelersPref)) {
          labelersPref.labelers = labelersPref.labelers.filter(
            (labeler) => labeler.did !== did,
          )
        }
        return prefs
          .filter((pref) => !AppBskyActorDefs.isLabelersPref(pref))
          .concat([labelersPref])
      },
    )
    // automatically configure the client
    this.configureLabelersHeader(prefsArrayToLabelerDids(prefs))
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

  async setInterestsPref(pref: Partial<BskyInterestsPreference>) {
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      const existing = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isInterestsPref(pref) &&
          AppBskyActorDefs.validateInterestsPref(pref).success,
      )
      if (existing) {
        pref = { ...existing, ...pref }
      }
      return prefs
        .filter((p) => !AppBskyActorDefs.isInterestsPref(p))
        .concat([{ ...pref, $type: 'app.bsky.actor.defs#interestsPref' }])
    })
  }

  async upsertMutedWords(newMutedWords: AppBskyActorDefs.MutedWord[]) {
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      let mutedWordsPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isMutedWordsPref(pref) &&
          AppBskyActorDefs.validateMutedWordsPref(pref).success,
      )

      if (mutedWordsPref && AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
        for (const updatedWord of newMutedWords) {
          let foundMatch = false
          const sanitizedUpdatedValue = sanitizeMutedWordValue(
            updatedWord.value,
          )

          // was trimmed down to an empty string e.g. single `#`
          if (!sanitizedUpdatedValue) continue

          for (const existingItem of mutedWordsPref.items) {
            if (existingItem.value === sanitizedUpdatedValue) {
              existingItem.targets = Array.from(
                new Set([...existingItem.targets, ...updatedWord.targets]),
              )
              foundMatch = true
              break
            }
          }

          if (!foundMatch) {
            mutedWordsPref.items.push({
              ...updatedWord,
              value: sanitizedUpdatedValue,
            })
          }
        }
      } else {
        // if the pref doesn't exist, create it
        mutedWordsPref = {
          items: newMutedWords.map((w) => ({
            ...w,
            value: sanitizeMutedWordValue(w.value),
          })),
        }
      }

      return prefs
        .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
        .concat([
          { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
        ])
    })
  }

  async updateMutedWord(mutedWord: AppBskyActorDefs.MutedWord) {
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      const mutedWordsPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isMutedWordsPref(pref) &&
          AppBskyActorDefs.validateMutedWordsPref(pref).success,
      )

      if (mutedWordsPref && AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
        for (const existingItem of mutedWordsPref.items) {
          if (existingItem.value === mutedWord.value) {
            existingItem.targets = mutedWord.targets
            break
          }
        }
      }

      return prefs
        .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
        .concat([
          { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
        ])
    })
  }

  async removeMutedWord(mutedWord: AppBskyActorDefs.MutedWord) {
    await updatePreferences(this, (prefs: AppBskyActorDefs.Preferences) => {
      const mutedWordsPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isMutedWordsPref(pref) &&
          AppBskyActorDefs.validateMutedWordsPref(pref).success,
      )

      if (mutedWordsPref && AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
        for (let i = 0; i < mutedWordsPref.items.length; i++) {
          const existing = mutedWordsPref.items[i]
          if (existing.value === mutedWord.value) {
            mutedWordsPref.items.splice(i, 1)
            break
          }
        }
      }

      return prefs
        .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
        .concat([
          { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
        ])
    })
  }

  async hidePost(postUri: string) {
    await updateHiddenPost(this, postUri, 'hide')
  }

  async unhidePost(postUri: string) {
    await updateHiddenPost(this, postUri, 'unhide')
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
    return res.data.preferences
  }
  await agent.app.bsky.actor.putPreferences({
    preferences: newPrefs,
  })
  return newPrefs
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

/**
 * Helper to transform the legacy content preferences.
 */
function adjustLegacyContentLabelPref(
  pref: AppBskyActorDefs.ContentLabelPref,
): AppBskyActorDefs.ContentLabelPref {
  let visibility = pref.visibility

  // adjust legacy values
  if (visibility === 'show') {
    visibility = 'ignore'
  }

  return { ...pref, visibility }
}

/**
 * Re-maps legacy labels to new labels on READ. Does not save these changes to
 * the user's preferences.
 */
function remapLegacyLabels(
  labels: BskyPreferences['moderationPrefs']['labels'],
) {
  const _labels = { ...labels }
  const legacyToNewMap: Record<string, string | undefined> = {
    gore: 'graphic-media',
    nsfw: 'porn',
    suggestive: 'sexual',
  }

  for (const labelName in _labels) {
    const newLabelName = legacyToNewMap[labelName]!
    if (newLabelName) {
      _labels[newLabelName] = _labels[labelName]
    }
  }

  return _labels
}

/**
 * A helper to get the currently enabled labelers from the full preferences array
 */
function prefsArrayToLabelerDids(
  prefs: AppBskyActorDefs.Preferences,
): string[] {
  const labelersPref = prefs.findLast(
    (pref) =>
      AppBskyActorDefs.isLabelersPref(pref) &&
      AppBskyActorDefs.validateLabelersPref(pref).success,
  )
  let dids: string[] = []
  if (labelersPref) {
    dids = (labelersPref as AppBskyActorDefs.LabelersPref).labelers.map(
      (labeler) => labeler.did,
    )
  }
  return dids
}

async function updateHiddenPost(
  agent: BskyAgent,
  postUri: string,
  action: 'hide' | 'unhide',
) {
  await updatePreferences(agent, (prefs: AppBskyActorDefs.Preferences) => {
    let pref = prefs.findLast(
      (pref) =>
        AppBskyActorDefs.isHiddenPostsPref(pref) &&
        AppBskyActorDefs.validateHiddenPostsPref(pref).success,
    )
    if (pref && AppBskyActorDefs.isHiddenPostsPref(pref)) {
      pref.items =
        action === 'hide'
          ? Array.from(new Set([...pref.items, postUri]))
          : pref.items.filter((uri) => uri !== postUri)
    } else {
      if (action === 'hide') {
        pref = {
          $type: 'app.bsky.actor.defs#hiddenPostsPref',
          items: [postUri],
        }
      }
    }
    return prefs
      .filter((p) => !AppBskyActorDefs.isInterestsPref(p))
      .concat([{ ...pref, $type: 'app.bsky.actor.defs#hiddenPostsPref' }])
  })
}

function isBskyPrefs(v: any): v is BskyPreferences {
  return (
    v &&
    typeof v === 'object' &&
    'moderationPrefs' in v &&
    isModPrefs(v.moderationPrefs)
  )
}

function isModPrefs(v: any): v is ModerationPrefs {
  return v && typeof v === 'object' && 'labelers' in v
}
