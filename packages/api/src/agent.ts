import { TID } from '@atproto/common-web'
import { AtUri, ensureValidDid } from '@atproto/syntax'
import {
  buildFetchHandler,
  BuildFetchHandlerOptions,
  FetchHandler,
  XrpcClient,
} from '@atproto/xrpc'
import AwaitLock from 'await-lock'
import {
  AppBskyActorDefs,
  AppBskyActorProfile,
  AppBskyFeedPost,
  AppBskyLabelerDefs,
  AppNS,
  ChatNS,
  ComAtprotoRepoPutRecord,
  ComNS,
  ToolsNS,
} from './client/index'
import { schemas } from './client/lexicons'
import { MutedWord, Nux } from './client/types/app/bsky/actor/defs'
import { BSKY_LABELER_DID } from './const'
import { interpretLabelValueDefinitions } from './moderation'
import { DEFAULT_LABEL_SETTINGS } from './moderation/const/labels'
import {
  InterpretedLabelValueDefinition,
  LabelPreference,
  ModerationPrefs,
} from './moderation/types'
import { SessionManager } from './session-manager'
import {
  AtpAgentGlobalOpts,
  AtprotoServiceType,
  BskyFeedViewPreference,
  BskyInterestsPreference,
  BskyPreferences,
  BskyThreadViewPreference,
} from './types'
import {
  asDid,
  Did,
  getSavedFeedType,
  isDid,
  sanitizeMutedWordValue,
  savedFeedsToUriArrays,
  validateSavedFeed,
  validateNux,
} from './util'

const FEED_VIEW_PREF_DEFAULTS = {
  hideReplies: false,
  hideRepliesByUnfollowed: true,
  hideRepliesByLikeCount: 0,
  hideReposts: false,
  hideQuotePosts: false,
}

const THREAD_VIEW_PREF_DEFAULTS = {
  sort: 'hotness',
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

export type { FetchHandler }

/**
 * An {@link Agent} is an {@link AtpBaseClient} with the following
 * additional features:
 * - AT Protocol labelers configuration utilities
 * - AT Protocol proxy configuration utilities
 * - Cloning utilities
 * - `app.bsky` syntactic sugar
 * - `com.atproto` syntactic sugar
 */
export class Agent extends XrpcClient {
  //#region Static configuration

  /**
   * The labelers to be used across all requests with the takedown capability
   */
  static appLabelers: readonly string[] = [BSKY_LABELER_DID]

  /**
   * Configures the Agent (or its sub classes) globally.
   */
  static configure(opts: AtpAgentGlobalOpts) {
    if (opts.appLabelers) {
      this.appLabelers = opts.appLabelers.map(asDid) // Validate & copy
    }
  }

  //#endregion

  com = new ComNS(this)
  app = new AppNS(this)
  chat = new ChatNS(this)
  tools = new ToolsNS(this)

  /** @deprecated use `this` instead */
  get xrpc(): XrpcClient {
    return this
  }

  readonly sessionManager: SessionManager

  constructor(options: string | URL | SessionManager) {
    const sessionManager: SessionManager =
      typeof options === 'string' || options instanceof URL
        ? {
            did: undefined,
            fetchHandler: buildFetchHandler(options),
          }
        : options

    super((url, init) => {
      const headers = new Headers(init?.headers)

      if (this.proxy && !headers.has('atproto-proxy')) {
        headers.set('atproto-proxy', this.proxy)
      }

      // Merge the labelers header of this particular request with the app &
      // instance labelers.
      headers.set(
        'atproto-accept-labelers',
        [
          ...this.appLabelers.map((l) => `${l};redact`),
          ...this.labelers,
          headers.get('atproto-accept-labelers')?.trim(),
        ]
          .filter(Boolean)
          .join(', '),
      )

      return this.sessionManager.fetchHandler(url, { ...init, headers })
    }, schemas)

    this.sessionManager = sessionManager
  }

  //#region Cloning utilities

  clone(): Agent {
    return this.copyInto(new Agent(this.sessionManager))
  }

  copyInto<T extends Agent>(inst: T): T {
    inst.configureLabelers(this.labelers)
    inst.configureProxy(this.proxy ?? null)
    inst.clearHeaders()
    for (const [key, value] of this.headers) inst.setHeader(key, value)
    return inst
  }

  withProxy(serviceType: AtprotoServiceType, did: string) {
    const inst = this.clone()
    inst.configureProxy(`${asDid(did)}#${serviceType}`)
    return inst as ReturnType<this['clone']>
  }

  //#endregion

  //#region ATPROTO labelers configuration utilities

  /**
   * The labelers statically configured on the class of the current instance.
   */
  get appLabelers() {
    return (this.constructor as typeof Agent).appLabelers
  }

  labelers: readonly string[] = []

  configureLabelers(labelerDids: readonly string[]) {
    this.labelers = labelerDids.map(asDid) // Validate & copy
  }

  /** @deprecated use {@link configureLabelers} instead */
  configureLabelersHeader(labelerDids: readonly string[]) {
    // Filtering non-did values for backwards compatibility
    this.configureLabelers(labelerDids.filter(isDid))
  }

  //#endregion

  //#region ATPROTO proxy configuration utilities

  proxy?: `${Did}#${AtprotoServiceType}`

  configureProxy(value: `${Did}#${AtprotoServiceType}` | null) {
    if (value === null) this.proxy = undefined
    else if (isDid(value)) this.proxy = value
    else throw new TypeError('Invalid proxy DID')
  }

  /** @deprecated use {@link configureProxy} instead */
  configureProxyHeader(serviceType: AtprotoServiceType, did: string) {
    // Ignoring non-did values for backwards compatibility
    if (isDid(did)) this.configureProxy(`${did}#${serviceType}`)
  }

  //#endregion

  //#region Session management

  /**
   * Get the authenticated user's DID, if any.
   */
  get did() {
    return this.sessionManager.did
  }

  /** @deprecated Use {@link Agent.assertDid} instead */
  get accountDid() {
    return this.assertDid
  }

  /**
   * Get the authenticated user's DID, or throw an error if not authenticated.
   */
  get assertDid(): string {
    this.assertAuthenticated()
    return this.did
  }

  /**
   * Assert that the user is authenticated.
   */
  public assertAuthenticated(): asserts this is { did: string } {
    if (!this.did) throw new Error('Not logged in')
  }

  //#endregion

  /** @deprecated use "this" instead */
  get api() {
    return this
  }

  //#region "com.atproto" lexicon short hand methods

  /**
   * Upload a binary blob to the server
   */
  uploadBlob: typeof this.com.atproto.repo.uploadBlob = (data, opts) =>
    this.com.atproto.repo.uploadBlob(data, opts)

  /**
   * Resolve a handle to a DID
   */
  resolveHandle: typeof this.com.atproto.identity.resolveHandle = (
    params,
    opts,
  ) => this.com.atproto.identity.resolveHandle(params, opts)

  /**
   * Change the user's handle
   */
  updateHandle: typeof this.com.atproto.identity.updateHandle = (data, opts) =>
    this.com.atproto.identity.updateHandle(data, opts)

  /**
   * Create a moderation report
   */
  createModerationReport: typeof this.com.atproto.moderation.createReport = (
    data,
    opts,
  ) => this.com.atproto.moderation.createReport(data, opts)

  //#endregion

  //#region "app.bsky" lexicon short hand methods

  getTimeline: typeof this.app.bsky.feed.getTimeline = (params, opts) =>
    this.app.bsky.feed.getTimeline(params, opts)

  getAuthorFeed: typeof this.app.bsky.feed.getAuthorFeed = (params, opts) =>
    this.app.bsky.feed.getAuthorFeed(params, opts)

  getActorLikes: typeof this.app.bsky.feed.getActorLikes = (params, opts) =>
    this.app.bsky.feed.getActorLikes(params, opts)

  getPostThread: typeof this.app.bsky.feed.getPostThread = (params, opts) =>
    this.app.bsky.feed.getPostThread(params, opts)

  getPost: typeof this.app.bsky.feed.post.get = (params) =>
    this.app.bsky.feed.post.get(params)

  getPosts: typeof this.app.bsky.feed.getPosts = (params, opts) =>
    this.app.bsky.feed.getPosts(params, opts)

  getLikes: typeof this.app.bsky.feed.getLikes = (params, opts) =>
    this.app.bsky.feed.getLikes(params, opts)

  getRepostedBy: typeof this.app.bsky.feed.getRepostedBy = (params, opts) =>
    this.app.bsky.feed.getRepostedBy(params, opts)

  getFollows: typeof this.app.bsky.graph.getFollows = (params, opts) =>
    this.app.bsky.graph.getFollows(params, opts)

  getFollowers: typeof this.app.bsky.graph.getFollowers = (params, opts) =>
    this.app.bsky.graph.getFollowers(params, opts)

  getProfile: typeof this.app.bsky.actor.getProfile = (params, opts) =>
    this.app.bsky.actor.getProfile(params, opts)

  getProfiles: typeof this.app.bsky.actor.getProfiles = (params, opts) =>
    this.app.bsky.actor.getProfiles(params, opts)

  getSuggestions: typeof this.app.bsky.actor.getSuggestions = (params, opts) =>
    this.app.bsky.actor.getSuggestions(params, opts)

  searchActors: typeof this.app.bsky.actor.searchActors = (params, opts) =>
    this.app.bsky.actor.searchActors(params, opts)

  searchActorsTypeahead: typeof this.app.bsky.actor.searchActorsTypeahead = (
    params,
    opts,
  ) => this.app.bsky.actor.searchActorsTypeahead(params, opts)

  listNotifications: typeof this.app.bsky.notification.listNotifications = (
    params,
    opts,
  ) => this.app.bsky.notification.listNotifications(params, opts)

  countUnreadNotifications: typeof this.app.bsky.notification.getUnreadCount = (
    params,
    opts,
  ) => this.app.bsky.notification.getUnreadCount(params, opts)

  getLabelers: typeof this.app.bsky.labeler.getServices = (params, opts) =>
    this.app.bsky.labeler.getServices(params, opts)

  async getLabelDefinitions(
    prefs: BskyPreferences | ModerationPrefs | string[],
  ): Promise<Record<string, InterpretedLabelValueDefinition[]>> {
    // collect the labeler dids
    const dids: string[] = [...this.appLabelers]
    if (isBskyPrefs(prefs)) {
      dids.push(...prefs.moderationPrefs.labelers.map((l) => l.did))
    } else if (isModPrefs(prefs)) {
      dids.push(...prefs.labelers.map((l) => l.did))
    } else {
      dids.push(...prefs)
    }

    // fetch their definitions
    const labelers = await this.getLabelers({
      dids,
      detailed: true,
    })

    // assemble a map of labeler dids to the interpreted label value definitions
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
    record.createdAt ||= new Date().toISOString()
    return this.app.bsky.feed.post.create(
      { repo: this.accountDid },
      record as AppBskyFeedPost.Record,
    )
  }

  async deletePost(postUri: string) {
    this.assertAuthenticated()

    const postUrip = new AtUri(postUri)
    return this.app.bsky.feed.post.delete({
      repo: postUrip.hostname,
      rkey: postUrip.rkey,
    })
  }

  async like(uri: string, cid: string) {
    return this.app.bsky.feed.like.create(
      { repo: this.accountDid },
      {
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
      },
    )
  }

  async deleteLike(likeUri: string) {
    this.assertAuthenticated()

    const likeUrip = new AtUri(likeUri)
    return this.app.bsky.feed.like.delete({
      repo: likeUrip.hostname,
      rkey: likeUrip.rkey,
    })
  }

  async repost(uri: string, cid: string) {
    return this.app.bsky.feed.repost.create(
      { repo: this.accountDid },
      {
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
      },
    )
  }

  async deleteRepost(repostUri: string) {
    this.assertAuthenticated()

    const repostUrip = new AtUri(repostUri)
    return this.app.bsky.feed.repost.delete({
      repo: repostUrip.hostname,
      rkey: repostUrip.rkey,
    })
  }

  async follow(subjectDid: string) {
    return this.app.bsky.graph.follow.create(
      { repo: this.accountDid },
      {
        subject: subjectDid,
        createdAt: new Date().toISOString(),
      },
    )
  }

  async deleteFollow(followUri: string) {
    this.assertAuthenticated()

    const followUrip = new AtUri(followUri)
    return this.app.bsky.graph.follow.delete({
      repo: followUrip.hostname,
      rkey: followUrip.rkey,
    })
  }

  async upsertProfile(
    updateFn: (
      existing: AppBskyActorProfile.Record | undefined,
    ) => AppBskyActorProfile.Record | Promise<AppBskyActorProfile.Record>,
  ) {
    const repo = this.accountDid

    let retriesRemaining = 5
    while (retriesRemaining >= 0) {
      // fetch existing
      const existing = await this.com.atproto.repo
        .getRecord({
          repo,
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
          repo,
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
    return this.app.bsky.graph.muteActor({ actor })
  }

  async unmute(actor: string) {
    return this.app.bsky.graph.unmuteActor({ actor })
  }

  async muteModList(uri: string) {
    return this.app.bsky.graph.muteActorList({ list: uri })
  }

  async unmuteModList(uri: string) {
    return this.app.bsky.graph.unmuteActorList({ list: uri })
  }

  async blockModList(uri: string) {
    return this.app.bsky.graph.listblock.create(
      { repo: this.accountDid },
      {
        subject: uri,
        createdAt: new Date().toISOString(),
      },
    )
  }

  async unblockModList(uri: string) {
    const repo = this.accountDid

    const listInfo = await this.app.bsky.graph.getList({
      list: uri,
      limit: 1,
    })

    const blocked = listInfo.data.list.viewer?.blocked
    if (blocked) {
      const { rkey } = new AtUri(blocked)
      return this.app.bsky.graph.listblock.delete({
        repo,
        rkey,
      })
    }
  }

  async updateSeenNotifications(seenAt = new Date().toISOString()) {
    return this.app.bsky.notification.updateSeen({ seenAt })
  }

  async getPreferences(): Promise<BskyPreferences> {
    const prefs: BskyPreferences = {
      feeds: {
        saved: undefined,
        pinned: undefined,
      },
      // @ts-ignore populating below
      savedFeeds: undefined,
      feedViewPrefs: {
        home: {
          ...FEED_VIEW_PREF_DEFAULTS,
        },
      },
      threadViewPrefs: { ...THREAD_VIEW_PREF_DEFAULTS },
      moderationPrefs: {
        adultContentEnabled: false,
        labels: { ...DEFAULT_LABEL_SETTINGS },
        labelers: this.appLabelers.map((did) => ({
          did,
          labels: {},
        })),
        mutedWords: [],
        hiddenPosts: [],
      },
      birthDate: undefined,
      interests: {
        tags: [],
      },
      bskyAppState: {
        queuedNudges: [],
        activeProgressGuide: undefined,
        nuxs: [],
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
        prefs.moderationPrefs.labelers = this.appLabelers
          .map((did: string) => ({ did, labels: {} }))
          .concat(
            pref.labelers.map((labeler) => ({
              ...labeler,
              labels: {},
            })),
          )
      } else if (
        AppBskyActorDefs.isSavedFeedsPrefV2(pref) &&
        AppBskyActorDefs.validateSavedFeedsPrefV2(pref).success
      ) {
        prefs.savedFeeds = pref.items
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

        if (prefs.moderationPrefs.mutedWords.length) {
          prefs.moderationPrefs.mutedWords =
            prefs.moderationPrefs.mutedWords.map((word) => {
              word.actorTarget = word.actorTarget || 'all'
              return word
            })
        }
      } else if (
        AppBskyActorDefs.isHiddenPostsPref(pref) &&
        AppBskyActorDefs.validateHiddenPostsPref(pref).success
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, ...v } = pref
        prefs.moderationPrefs.hiddenPosts = v.items
      } else if (
        AppBskyActorDefs.isBskyAppStatePref(pref) &&
        AppBskyActorDefs.validateBskyAppStatePref(pref).success
      ) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { $type, ...v } = pref
        prefs.bskyAppState.queuedNudges = v.queuedNudges || []
        prefs.bskyAppState.activeProgressGuide = v.activeProgressGuide
        prefs.bskyAppState.nuxs = v.nuxs || []
      }
    }

    /*
     * If `prefs.savedFeeds` is undefined, no `savedFeedsPrefV2` exists, which
     * means we want to try to migrate if needed.
     *
     * If v1 prefs exist, they will be migrated to v2.
     *
     * If no v1 prefs exist, the user is either new, or could be old and has
     * never edited their feeds.
     */
    if (prefs.savedFeeds == null) {
      const { saved, pinned } = prefs.feeds

      if (saved && pinned) {
        const uniqueMigratedSavedFeeds: Map<
          string,
          AppBskyActorDefs.SavedFeed
        > = new Map()

        // insert Following feed first
        uniqueMigratedSavedFeeds.set('timeline', {
          id: TID.nextStr(),
          type: 'timeline',
          value: 'following',
          pinned: true,
        })

        // use pinned as source of truth for feed order
        for (const uri of pinned) {
          const type = getSavedFeedType(uri)
          // only want supported types
          if (type === 'unknown') continue
          uniqueMigratedSavedFeeds.set(uri, {
            id: TID.nextStr(),
            type,
            value: uri,
            pinned: true,
          })
        }

        for (const uri of saved) {
          if (!uniqueMigratedSavedFeeds.has(uri)) {
            const type = getSavedFeedType(uri)
            // only want supported types
            if (type === 'unknown') continue
            uniqueMigratedSavedFeeds.set(uri, {
              id: TID.nextStr(),
              type,
              value: uri,
              pinned: false,
            })
          }
        }

        prefs.savedFeeds = Array.from(uniqueMigratedSavedFeeds.values())
      } else {
        prefs.savedFeeds = [
          {
            id: TID.nextStr(),
            type: 'timeline',
            value: 'following',
            pinned: true,
          },
        ]
      }

      // save to user preferences so this migration doesn't re-occur
      await this.overwriteSavedFeeds(prefs.savedFeeds)
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
    this.configureLabelers(prefsArrayToLabelerDids(res.data.preferences))

    return prefs
  }

  async overwriteSavedFeeds(savedFeeds: AppBskyActorDefs.SavedFeed[]) {
    savedFeeds.forEach(validateSavedFeed)
    const uniqueSavedFeeds = new Map<string, AppBskyActorDefs.SavedFeed>()
    savedFeeds.forEach((feed) => {
      // remove and re-insert to preserve order
      if (uniqueSavedFeeds.has(feed.id)) {
        uniqueSavedFeeds.delete(feed.id)
      }
      uniqueSavedFeeds.set(feed.id, feed)
    })
    return this.updateSavedFeedsV2Preferences(() =>
      Array.from(uniqueSavedFeeds.values()),
    )
  }

  async updateSavedFeeds(savedFeedsToUpdate: AppBskyActorDefs.SavedFeed[]) {
    savedFeedsToUpdate.map(validateSavedFeed)
    return this.updateSavedFeedsV2Preferences((savedFeeds) => {
      return savedFeeds.map((savedFeed) => {
        const updatedVersion = savedFeedsToUpdate.find(
          (updated) => savedFeed.id === updated.id,
        )
        if (updatedVersion) {
          return {
            ...savedFeed,
            // only update pinned
            pinned: updatedVersion.pinned,
          }
        }
        return savedFeed
      })
    })
  }

  async addSavedFeeds(
    savedFeeds: Pick<AppBskyActorDefs.SavedFeed, 'type' | 'value' | 'pinned'>[],
  ) {
    const toSave: AppBskyActorDefs.SavedFeed[] = savedFeeds.map((f) => ({
      ...f,
      id: TID.nextStr(),
    }))
    toSave.forEach(validateSavedFeed)
    return this.updateSavedFeedsV2Preferences((savedFeeds) => [
      ...savedFeeds,
      ...toSave,
    ])
  }

  async removeSavedFeeds(ids: string[]) {
    return this.updateSavedFeedsV2Preferences((savedFeeds) => [
      ...savedFeeds.filter((feed) => !ids.find((id) => feed.id === id)),
    ])
  }

  /**
   * @deprecated use `overwriteSavedFeeds`
   */
  async setSavedFeeds(saved: string[], pinned: string[]) {
    return this.updateFeedPreferences(() => ({
      saved,
      pinned,
    }))
  }

  /**
   * @deprecated use `addSavedFeeds`
   */
  async addSavedFeed(v: string) {
    return this.updateFeedPreferences((saved: string[], pinned: string[]) => ({
      saved: [...saved.filter((uri) => uri !== v), v],
      pinned,
    }))
  }

  /**
   * @deprecated use `removeSavedFeeds`
   */
  async removeSavedFeed(v: string) {
    return this.updateFeedPreferences((saved: string[], pinned: string[]) => ({
      saved: saved.filter((uri) => uri !== v),
      pinned: pinned.filter((uri) => uri !== v),
    }))
  }

  /**
   * @deprecated use `addSavedFeeds` or `updateSavedFeeds`
   */
  async addPinnedFeed(v: string) {
    return this.updateFeedPreferences((saved: string[], pinned: string[]) => ({
      saved: [...saved.filter((uri) => uri !== v), v],
      pinned: [...pinned.filter((uri) => uri !== v), v],
    }))
  }

  /**
   * @deprecated use `updateSavedFeeds` or `removeSavedFeeds`
   */
  async removePinnedFeed(v: string) {
    return this.updateFeedPreferences((saved: string[], pinned: string[]) => ({
      saved,
      pinned: pinned.filter((uri) => uri !== v),
    }))
  }

  async setAdultContentEnabled(v: boolean) {
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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
    const prefs = await this.updatePreferences(
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
    this.configureLabelers(prefsArrayToLabelerDids(prefs))
  }

  async removeLabeler(did: string) {
    const prefs = await this.updatePreferences(
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
    this.configureLabelers(prefsArrayToLabelerDids(prefs))
  }

  async setPersonalDetails({
    birthDate,
  }: {
    birthDate: string | Date | undefined
  }) {
    birthDate = birthDate instanceof Date ? birthDate.toISOString() : birthDate
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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

  /**
   * Add a muted word to user preferences.
   */
  async addMutedWord(
    mutedWord: Pick<
      MutedWord,
      'value' | 'targets' | 'actorTarget' | 'expiresAt'
    >,
  ) {
    const sanitizedValue = sanitizeMutedWordValue(mutedWord.value)

    if (!sanitizedValue) return

    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      let mutedWordsPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isMutedWordsPref(pref) &&
          AppBskyActorDefs.validateMutedWordsPref(pref).success,
      )

      const newMutedWord: AppBskyActorDefs.MutedWord = {
        id: TID.nextStr(),
        value: sanitizedValue,
        targets: mutedWord.targets || [],
        actorTarget: mutedWord.actorTarget || 'all',
        expiresAt: mutedWord.expiresAt || undefined,
      }

      if (mutedWordsPref && AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
        mutedWordsPref.items.push(newMutedWord)

        /**
         * Migrate any old muted words that don't have an id
         */
        mutedWordsPref.items = migrateLegacyMutedWordsItems(
          mutedWordsPref.items,
        )
      } else {
        // if the pref doesn't exist, create it
        mutedWordsPref = {
          items: [newMutedWord],
        }
      }

      return prefs
        .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
        .concat([
          { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
        ])
    })
  }

  /**
   * Convenience method to add muted words to user preferences
   */
  async addMutedWords(newMutedWords: AppBskyActorDefs.MutedWord[]) {
    await Promise.all(newMutedWords.map((word) => this.addMutedWord(word)))
  }

  /**
   * @deprecated use `addMutedWords` or `addMutedWord` instead
   */
  async upsertMutedWords(
    mutedWords: Pick<
      MutedWord,
      'value' | 'targets' | 'actorTarget' | 'expiresAt'
    >[],
  ) {
    await this.addMutedWords(mutedWords)
  }

  /**
   * Update a muted word in user preferences.
   */
  async updateMutedWord(mutedWord: AppBskyActorDefs.MutedWord) {
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      const mutedWordsPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isMutedWordsPref(pref) &&
          AppBskyActorDefs.validateMutedWordsPref(pref).success,
      )

      if (mutedWordsPref && AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
        mutedWordsPref.items = mutedWordsPref.items.map((existingItem) => {
          const match = matchMutedWord(existingItem, mutedWord)

          if (match) {
            const updated = {
              ...existingItem,
              ...mutedWord,
            }
            return {
              id: existingItem.id || TID.nextStr(),
              value:
                sanitizeMutedWordValue(updated.value) || existingItem.value,
              targets: updated.targets || [],
              actorTarget: updated.actorTarget || 'all',
              expiresAt: updated.expiresAt || undefined,
            }
          } else {
            return existingItem
          }
        })

        /**
         * Migrate any old muted words that don't have an id
         */
        mutedWordsPref.items = migrateLegacyMutedWordsItems(
          mutedWordsPref.items,
        )

        return prefs
          .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
          .concat([
            { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
          ])
      }

      return prefs
    })
  }

  /**
   * Remove a muted word from user preferences.
   */
  async removeMutedWord(mutedWord: AppBskyActorDefs.MutedWord) {
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      const mutedWordsPref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isMutedWordsPref(pref) &&
          AppBskyActorDefs.validateMutedWordsPref(pref).success,
      )

      if (mutedWordsPref && AppBskyActorDefs.isMutedWordsPref(mutedWordsPref)) {
        for (let i = 0; i < mutedWordsPref.items.length; i++) {
          const match = matchMutedWord(mutedWordsPref.items[i], mutedWord)

          if (match) {
            mutedWordsPref.items.splice(i, 1)
            break
          }
        }

        /**
         * Migrate any old muted words that don't have an id
         */
        mutedWordsPref.items = migrateLegacyMutedWordsItems(
          mutedWordsPref.items,
        )

        return prefs
          .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
          .concat([
            { ...mutedWordsPref, $type: 'app.bsky.actor.defs#mutedWordsPref' },
          ])
      }

      return prefs
    })
  }

  /**
   * Convenience method to remove muted words from user preferences
   */
  async removeMutedWords(mutedWords: AppBskyActorDefs.MutedWord[]) {
    await Promise.all(mutedWords.map((word) => this.removeMutedWord(word)))
  }

  async hidePost(postUri: string) {
    await this.updateHiddenPost(postUri, 'hide')
  }

  async unhidePost(postUri: string) {
    await this.updateHiddenPost(postUri, 'unhide')
  }

  async bskyAppQueueNudges(nudges: string | string[]) {
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      let bskyAppStatePref: AppBskyActorDefs.BskyAppStatePref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isBskyAppStatePref(pref) &&
          AppBskyActorDefs.validateBskyAppStatePref(pref).success,
      )

      bskyAppStatePref = bskyAppStatePref || {}
      nudges = Array.isArray(nudges) ? nudges : [nudges]
      bskyAppStatePref.queuedNudges = (
        bskyAppStatePref.queuedNudges || []
      ).concat(nudges)

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat([
          {
            ...bskyAppStatePref,
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
          },
        ])
    })
  }

  async bskyAppDismissNudges(nudges: string | string[]) {
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      let bskyAppStatePref: AppBskyActorDefs.BskyAppStatePref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isBskyAppStatePref(pref) &&
          AppBskyActorDefs.validateBskyAppStatePref(pref).success,
      )

      bskyAppStatePref = bskyAppStatePref || {}
      nudges = Array.isArray(nudges) ? nudges : [nudges]
      bskyAppStatePref.queuedNudges = (
        bskyAppStatePref.queuedNudges || []
      ).filter((nudge) => !nudges.includes(nudge))

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat([
          {
            ...bskyAppStatePref,
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
          },
        ])
    })
  }

  async bskyAppSetActiveProgressGuide(
    guide: AppBskyActorDefs.BskyAppProgressGuide | undefined,
  ) {
    if (
      guide &&
      !AppBskyActorDefs.validateBskyAppProgressGuide(guide).success
    ) {
      throw new Error('Invalid progress guide')
    }

    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      let bskyAppStatePref: AppBskyActorDefs.BskyAppStatePref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isBskyAppStatePref(pref) &&
          AppBskyActorDefs.validateBskyAppStatePref(pref).success,
      )

      bskyAppStatePref = bskyAppStatePref || {}
      bskyAppStatePref.activeProgressGuide = guide

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat([
          {
            ...bskyAppStatePref,
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
          },
        ])
    })
  }

  /**
   * Insert or update a NUX in user prefs
   */
  async bskyAppUpsertNux(nux: Nux) {
    validateNux(nux)

    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      let bskyAppStatePref: AppBskyActorDefs.BskyAppStatePref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isBskyAppStatePref(pref) &&
          AppBskyActorDefs.validateBskyAppStatePref(pref).success,
      )

      bskyAppStatePref = bskyAppStatePref || {}
      bskyAppStatePref.nuxs = bskyAppStatePref.nuxs || []

      const existing = bskyAppStatePref.nuxs?.find((n) => {
        return n.id === nux.id
      })

      let next: AppBskyActorDefs.Nux

      if (existing) {
        next = {
          id: existing.id,
          completed: nux.completed,
          data: nux.data,
          expiresAt: nux.expiresAt,
        }
      } else {
        next = nux
      }

      // remove duplicates and append
      bskyAppStatePref.nuxs = bskyAppStatePref.nuxs
        .filter((n) => n.id !== nux.id)
        .concat(next)

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat([
          {
            ...bskyAppStatePref,
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
          },
        ])
    })
  }

  /**
   * Removes NUXs from user preferences.
   */
  async bskyAppRemoveNuxs(ids: string[]) {
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      let bskyAppStatePref: AppBskyActorDefs.BskyAppStatePref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isBskyAppStatePref(pref) &&
          AppBskyActorDefs.validateBskyAppStatePref(pref).success,
      )

      bskyAppStatePref = bskyAppStatePref || {}
      bskyAppStatePref.nuxs = (bskyAppStatePref.nuxs || []).filter((nux) => {
        return !ids.includes(nux.id)
      })

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat([
          {
            ...bskyAppStatePref,
            $type: 'app.bsky.actor.defs#bskyAppStatePref',
          },
        ])
    })
  }

  //- Private methods

  #prefsLock = new AwaitLock()

  /**
   * This function updates the preferences of a user and allows for a callback function to be executed
   * before the update.
   * @param cb - cb is a callback function that takes in a single parameter of type
   * AppBskyActorDefs.Preferences and returns either a boolean or void. This callback function is used to
   * update the preferences of the user. The function is called with the current preferences as an
   * argument and if the callback returns false, the preferences are not updated.
   */
  private async updatePreferences(
    cb: (
      prefs: AppBskyActorDefs.Preferences,
    ) => AppBskyActorDefs.Preferences | false,
  ) {
    try {
      await this.#prefsLock.acquireAsync()
      const res = await this.app.bsky.actor.getPreferences({})
      const newPrefs = cb(res.data.preferences)
      if (newPrefs === false) {
        return res.data.preferences
      }
      await this.app.bsky.actor.putPreferences({
        preferences: newPrefs,
      })
      return newPrefs
    } finally {
      this.#prefsLock.release()
    }
  }

  private async updateHiddenPost(postUri: string, action: 'hide' | 'unhide') {
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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

  /**
   * A helper specifically for updating feed preferences
   */
  private async updateFeedPreferences(
    cb: (
      saved: string[],
      pinned: string[],
    ) => { saved: string[]; pinned: string[] },
  ): Promise<{ saved: string[]; pinned: string[] }> {
    let res
    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
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

  private async updateSavedFeedsV2Preferences(
    cb: (
      savedFeedsPref: AppBskyActorDefs.SavedFeed[],
    ) => AppBskyActorDefs.SavedFeed[],
  ): Promise<AppBskyActorDefs.SavedFeed[]> {
    let maybeMutatedSavedFeeds: AppBskyActorDefs.SavedFeed[] = []

    await this.updatePreferences((prefs: AppBskyActorDefs.Preferences) => {
      let existingV2Pref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isSavedFeedsPrefV2(pref) &&
          AppBskyActorDefs.validateSavedFeedsPrefV2(pref).success,
      ) as AppBskyActorDefs.SavedFeedsPrefV2 | undefined
      let existingV1Pref = prefs.findLast(
        (pref) =>
          AppBskyActorDefs.isSavedFeedsPref(pref) &&
          AppBskyActorDefs.validateSavedFeedsPref(pref).success,
      ) as AppBskyActorDefs.SavedFeedsPref | undefined

      if (existingV2Pref) {
        maybeMutatedSavedFeeds = cb(existingV2Pref.items)
        existingV2Pref = {
          ...existingV2Pref,
          items: maybeMutatedSavedFeeds,
        }
      } else {
        maybeMutatedSavedFeeds = cb([])
        existingV2Pref = {
          $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
          items: maybeMutatedSavedFeeds,
        }
      }

      // enforce ordering, pinned then saved
      const pinned = existingV2Pref.items.filter((i) => i.pinned)
      const saved = existingV2Pref.items.filter((i) => !i.pinned)
      existingV2Pref.items = pinned.concat(saved)

      let updatedPrefs = prefs
        .filter((pref) => !AppBskyActorDefs.isSavedFeedsPrefV2(pref))
        .concat(existingV2Pref)

      /*
       * If there's a v2 pref present, it means this account was migrated from v1
       * to v2. During the transition period, we double write v2 prefs back to
       * v1, but NOT the other way around.
       */
      if (existingV1Pref) {
        const { saved, pinned } = existingV1Pref
        const v2Compat = savedFeedsToUriArrays(
          // v1 only supports feeds and lists
          existingV2Pref.items.filter((i) => ['feed', 'list'].includes(i.type)),
        )
        existingV1Pref = {
          ...existingV1Pref,
          saved: Array.from(new Set([...saved, ...v2Compat.saved])),
          pinned: Array.from(new Set([...pinned, ...v2Compat.pinned])),
        }
        updatedPrefs = updatedPrefs
          .filter((pref) => !AppBskyActorDefs.isSavedFeedsPref(pref))
          .concat(existingV1Pref)
      }

      return updatedPrefs
    })

    return maybeMutatedSavedFeeds
  }

  //#endregion
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

function migrateLegacyMutedWordsItems(items: AppBskyActorDefs.MutedWord[]) {
  return items.map((item) => ({
    ...item,
    id: item.id || TID.nextStr(),
  }))
}

function matchMutedWord(
  existingWord: AppBskyActorDefs.MutedWord,
  newWord: AppBskyActorDefs.MutedWord,
): boolean {
  // id is undefined in legacy implementation
  const existingId = existingWord.id
  // prefer matching based on id
  const matchById = existingId && existingId === newWord.id
  // handle legacy case where id is not set
  const legacyMatchByValue = !existingId && existingWord.value === newWord.value

  return matchById || legacyMatchByValue
}
