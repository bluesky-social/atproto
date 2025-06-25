import AwaitLock from 'await-lock'
import { TID, retry } from '@atproto/common-web'
import { AtUri, ensureValidDid } from '@atproto/syntax'
import {
  FetchHandler,
  FetchHandlerOptions,
  XrpcClient,
  buildFetchHandler,
} from '@atproto/xrpc'
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
import { $Typed, Un$Typed } from './client/util'
import { BSKY_LABELER_DID } from './const'
import { interpretLabelValueDefinitions } from './moderation'
import { DEFAULT_LABEL_SETTINGS } from './moderation/const/labels'
import {
  InterpretedLabelValueDefinition,
  LabelPreference,
  ModerationPrefs,
} from './moderation/types'
import * as predicate from './predicate'
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
  Did,
  asDid,
  getSavedFeedType,
  isDid,
  sanitizeMutedWordValue,
  savedFeedsToUriArrays,
  validateNux,
  validateSavedFeed,
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

  constructor(options: SessionManager | FetchHandler | FetchHandlerOptions) {
    const sessionManager: SessionManager =
      typeof options === 'object' && 'fetchHandler' in options
        ? options
        : {
            did: undefined,
            fetchHandler: buildFetchHandler(options),
          }

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

  async like(uri: string, cid: string, via?: { uri: string; cid: string }) {
    return this.app.bsky.feed.like.create(
      { repo: this.accountDid },
      {
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
        via,
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

  async repost(uri: string, cid: string, via?: { uri: string; cid: string }) {
    return this.app.bsky.feed.repost.create(
      { repo: this.accountDid },
      {
        subject: { uri, cid },
        createdAt: new Date().toISOString(),
        via,
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

  /**
   * @note: Using this method will reset the whole profile record if it
   * previously contained invalid values (wrt to the profile lexicon).
   */
  async upsertProfile(
    updateFn: (
      existing: AppBskyActorProfile.Record | undefined,
    ) =>
      | Un$Typed<AppBskyActorProfile.Record>
      | Promise<Un$Typed<AppBskyActorProfile.Record>>,
  ): Promise<void> {
    const upsert = async () => {
      const repo = this.assertDid
      const collection = 'app.bsky.actor.profile'

      const existing = await this.com.atproto.repo
        .getRecord({ repo, collection, rkey: 'self' })
        .catch((_) => undefined)

      const existingRecord: AppBskyActorProfile.Record | undefined =
        existing && predicate.isValidProfile(existing.data.value)
          ? existing.data.value
          : undefined

      // run the update
      const updated = await updateFn(existingRecord)

      // validate the value returned by the update function
      const validation = AppBskyActorProfile.validateRecord({
        $type: collection,
        ...updated,
      })

      if (!validation.success) {
        throw validation.error
      }

      await this.com.atproto.repo.putRecord({
        repo,
        collection,
        rkey: 'self',
        record: validation.value,
        swapRecord: existing?.data.cid || null,
      })
    }

    return retry(upsert, {
      maxRetries: 5,
      retryable: (e) => e instanceof ComAtprotoRepoPutRecord.InvalidSwapError,
    })
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
      postInteractionSettings: {
        threadgateAllowRules: undefined,
        postgateEmbeddingRules: undefined,
      },
      verificationPrefs: {
        hideBadges: false,
      },
    }
    const res = await this.app.bsky.actor.getPreferences({})
    const labelPrefs: AppBskyActorDefs.ContentLabelPref[] = []
    for (const pref of res.data.preferences) {
      if (predicate.isValidAdultContentPref(pref)) {
        // adult content preferences
        prefs.moderationPrefs.adultContentEnabled = pref.enabled
      } else if (predicate.isValidContentLabelPref(pref)) {
        // content label preference
        const adjustedPref = adjustLegacyContentLabelPref(pref)
        labelPrefs.push(adjustedPref)
      } else if (predicate.isValidLabelersPref(pref)) {
        // labelers preferences
        prefs.moderationPrefs.labelers = this.appLabelers
          .map((did: string) => ({ did, labels: {} }))
          .concat(
            pref.labelers.map((labeler) => ({
              ...labeler,
              labels: {},
            })),
          )
      } else if (predicate.isValidSavedFeedsPrefV2(pref)) {
        prefs.savedFeeds = pref.items
      } else if (predicate.isValidSavedFeedsPref(pref)) {
        // saved and pinned feeds
        prefs.feeds.saved = pref.saved
        prefs.feeds.pinned = pref.pinned
      } else if (predicate.isValidPersonalDetailsPref(pref)) {
        // birth date (irl)
        if (pref.birthDate) {
          prefs.birthDate = new Date(pref.birthDate)
        }
      } else if (predicate.isValidFeedViewPref(pref)) {
        // feed view preferences
        const { $type: _, feed, ...v } = pref
        prefs.feedViewPrefs[feed] = { ...FEED_VIEW_PREF_DEFAULTS, ...v }
      } else if (predicate.isValidThreadViewPref(pref)) {
        // thread view preferences
        const { $type: _, ...v } = pref
        prefs.threadViewPrefs = { ...prefs.threadViewPrefs, ...v }
      } else if (predicate.isValidInterestsPref(pref)) {
        const { $type: _, ...v } = pref
        prefs.interests = { ...prefs.interests, ...v }
      } else if (predicate.isValidMutedWordsPref(pref)) {
        prefs.moderationPrefs.mutedWords = pref.items

        if (prefs.moderationPrefs.mutedWords.length) {
          prefs.moderationPrefs.mutedWords =
            prefs.moderationPrefs.mutedWords.map((word) => {
              word.actorTarget = word.actorTarget || 'all'
              return word
            })
        }
      } else if (predicate.isValidHiddenPostsPref(pref)) {
        prefs.moderationPrefs.hiddenPosts = pref.items
      } else if (predicate.isValidBskyAppStatePref(pref)) {
        prefs.bskyAppState.queuedNudges = pref.queuedNudges || []
        prefs.bskyAppState.activeProgressGuide = pref.activeProgressGuide
        prefs.bskyAppState.nuxs = pref.nuxs || []
      } else if (predicate.isValidPostInteractionSettingsPref(pref)) {
        prefs.postInteractionSettings.threadgateAllowRules =
          pref.threadgateAllowRules
        prefs.postInteractionSettings.postgateEmbeddingRules =
          pref.postgateEmbeddingRules
      } else if (predicate.isValidVerificationPrefs(pref)) {
        prefs.verificationPrefs = {
          hideBadges: pref.hideBadges,
        }
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
    await this.updatePreferences((prefs) => {
      const adultContentPref = prefs.findLast(
        predicate.isValidAdultContentPref,
      ) || {
        $type: 'app.bsky.actor.defs#adultContentPref',
        enabled: v,
      }

      adultContentPref.enabled = v

      return prefs
        .filter((pref) => !AppBskyActorDefs.isAdultContentPref(pref))
        .concat(adultContentPref)
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
    await this.updatePreferences((prefs) => {
      const labelPref = prefs
        .filter(predicate.isValidContentLabelPref)
        .findLast(
          (pref) => pref.label === key && pref.labelerDid === labelerDid,
        ) || {
        $type: 'app.bsky.actor.defs#contentLabelPref',
        label: key,
        labelerDid,
        visibility: value,
      }

      labelPref.visibility = value

      let legacyLabelPref: $Typed<AppBskyActorDefs.ContentLabelPref> | undefined
      if (AppBskyActorDefs.isContentLabelPref(labelPref)) {
        // is global
        if (!labelPref.labelerDid) {
          const legacyLabelValue = {
            'graphic-media': 'gore',
            porn: 'nsfw',
            sexual: 'suggestive',
            // Protect against using toString, hasOwnProperty, etc. as a label:
            __proto__: null,
          }[labelPref.label]

          // if it's a legacy label, double-write the legacy label
          if (legacyLabelValue) {
            legacyLabelPref = prefs
              .filter(predicate.isValidContentLabelPref)
              .findLast(
                (pref) =>
                  pref.label === legacyLabelValue &&
                  pref.labelerDid === undefined,
              ) || {
              $type: 'app.bsky.actor.defs#contentLabelPref',
              label: legacyLabelValue,
              labelerDid: undefined,
              visibility: value,
            }

            legacyLabelPref!.visibility = value
          }
        }
      }

      return prefs
        .filter(
          (pref) =>
            !AppBskyActorDefs.isContentLabelPref(pref) ||
            !(pref.label === key && pref.labelerDid === labelerDid),
        )
        .concat(labelPref)
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
    const prefs = await this.updatePreferences((prefs) => {
      const labelersPref = prefs.findLast(predicate.isValidLabelersPref) || {
        $type: 'app.bsky.actor.defs#labelersPref',
        labelers: [],
      }

      if (!labelersPref.labelers.some((labeler) => labeler.did === did)) {
        labelersPref.labelers.push({ did })
      }

      return prefs
        .filter((pref) => !AppBskyActorDefs.isLabelersPref(pref))
        .concat(labelersPref)
    })
    // automatically configure the client
    this.configureLabelers(prefsArrayToLabelerDids(prefs))
  }

  async removeLabeler(did: string) {
    const prefs = await this.updatePreferences((prefs) => {
      const labelersPref = prefs.findLast(predicate.isValidLabelersPref) || {
        $type: 'app.bsky.actor.defs#labelersPref',
        labelers: [],
      }

      labelersPref.labelers = labelersPref.labelers.filter((l) => l.did !== did)

      return prefs
        .filter((pref) => !AppBskyActorDefs.isLabelersPref(pref))
        .concat(labelersPref)
    })
    // automatically configure the client
    this.configureLabelers(prefsArrayToLabelerDids(prefs))
  }

  async setPersonalDetails({
    birthDate,
  }: {
    birthDate: string | Date | undefined
  }) {
    await this.updatePreferences((prefs) => {
      const personalDetailsPref = prefs.findLast(
        predicate.isValidPersonalDetailsPref,
      ) || {
        $type: 'app.bsky.actor.defs#personalDetailsPref',
      }

      personalDetailsPref.birthDate =
        birthDate instanceof Date ? birthDate.toISOString() : birthDate

      return prefs
        .filter((pref) => !AppBskyActorDefs.isPersonalDetailsPref(pref))
        .concat(personalDetailsPref)
    })
  }

  async setFeedViewPrefs(feed: string, pref: Partial<BskyFeedViewPreference>) {
    await this.updatePreferences((prefs) => {
      const existing = prefs
        .filter(predicate.isValidFeedViewPref)
        .findLast((pref) => pref.feed === feed)

      return prefs
        .filter((p) => !AppBskyActorDefs.isFeedViewPref(p) || p.feed !== feed)
        .concat({
          ...existing,
          ...pref,
          $type: 'app.bsky.actor.defs#feedViewPref',
          feed,
        })
    })
  }

  async setThreadViewPrefs(pref: Partial<BskyThreadViewPreference>) {
    await this.updatePreferences((prefs) => {
      const existing = prefs.findLast(predicate.isValidThreadViewPref)

      return prefs
        .filter((p) => !AppBskyActorDefs.isThreadViewPref(p))
        .concat({
          ...existing,
          ...pref,
          $type: 'app.bsky.actor.defs#threadViewPref',
        })
    })
  }

  async setInterestsPref(pref: Partial<BskyInterestsPreference>) {
    await this.updatePreferences((prefs) => {
      const existing = prefs.findLast(predicate.isValidInterestsPref)

      return prefs
        .filter((p) => !AppBskyActorDefs.isInterestsPref(p))
        .concat({
          ...existing,
          ...pref,
          $type: 'app.bsky.actor.defs#interestsPref',
        })
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

    await this.updatePreferences((prefs) => {
      let mutedWordsPref = prefs.findLast(predicate.isValidMutedWordsPref)

      const newMutedWord: AppBskyActorDefs.MutedWord = {
        id: TID.nextStr(),
        value: sanitizedValue,
        targets: mutedWord.targets || [],
        actorTarget: mutedWord.actorTarget || 'all',
        expiresAt: mutedWord.expiresAt || undefined,
      }

      if (mutedWordsPref) {
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
          $type: 'app.bsky.actor.defs#mutedWordsPref',
          items: [newMutedWord],
        }
      }

      return prefs
        .filter((p) => !AppBskyActorDefs.isMutedWordsPref(p))
        .concat(mutedWordsPref)
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
    await this.updatePreferences((prefs) => {
      const mutedWordsPref = prefs.findLast(predicate.isValidMutedWordsPref)

      if (mutedWordsPref) {
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
          .concat(mutedWordsPref)
      }

      return prefs
    })
  }

  /**
   * Remove a muted word from user preferences.
   */
  async removeMutedWord(mutedWord: AppBskyActorDefs.MutedWord) {
    await this.updatePreferences((prefs) => {
      const mutedWordsPref = prefs.findLast(predicate.isValidMutedWordsPref)

      if (mutedWordsPref) {
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
          .concat(mutedWordsPref)
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
    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(predicate.isValidBskyAppStatePref) || {
        $type: 'app.bsky.actor.defs#bskyAppStatePref',
      }

      pref.queuedNudges = (pref.queuedNudges || []).concat(nudges)

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat(pref)
    })
  }

  async bskyAppDismissNudges(nudges: string | string[]) {
    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(predicate.isValidBskyAppStatePref) || {
        $type: 'app.bsky.actor.defs#bskyAppStatePref',
      }

      nudges = Array.isArray(nudges) ? nudges : [nudges]
      pref.queuedNudges = (pref.queuedNudges || []).filter(
        (nudge) => !nudges.includes(nudge),
      )

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat(pref)
    })
  }

  async bskyAppSetActiveProgressGuide(
    guide: AppBskyActorDefs.BskyAppProgressGuide | undefined,
  ) {
    if (guide) {
      const result = AppBskyActorDefs.validateBskyAppProgressGuide(guide)
      if (!result.success) throw result.error
    }

    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(predicate.isValidBskyAppStatePref) || {
        $type: 'app.bsky.actor.defs#bskyAppStatePref',
      }

      pref.activeProgressGuide = guide

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat(pref)
    })
  }

  /**
   * Insert or update a NUX in user prefs
   */
  async bskyAppUpsertNux(nux: Nux) {
    validateNux(nux)

    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(predicate.isValidBskyAppStatePref) || {
        $type: 'app.bsky.actor.defs#bskyAppStatePref',
      }

      pref.nuxs = pref.nuxs || []

      const existing = pref.nuxs?.find((n) => {
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
      pref.nuxs = pref.nuxs.filter((n) => n.id !== nux.id).concat(next)

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat(pref)
    })
  }

  /**
   * Removes NUXs from user preferences.
   */
  async bskyAppRemoveNuxs(ids: string[]) {
    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(predicate.isValidBskyAppStatePref) || {
        $type: 'app.bsky.actor.defs#bskyAppStatePref',
      }

      pref.nuxs = (pref.nuxs || []).filter((nux) => !ids.includes(nux.id))

      return prefs
        .filter((p) => !AppBskyActorDefs.isBskyAppStatePref(p))
        .concat(pref)
    })
  }

  async setPostInteractionSettings(
    settings: AppBskyActorDefs.PostInteractionSettingsPref,
  ) {
    const result =
      AppBskyActorDefs.validatePostInteractionSettingsPref(settings)
    // Fool-proofing (should not be needed because of type safety)
    if (!result.success) throw result.error

    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(
        predicate.isValidPostInteractionSettingsPref,
      ) || {
        $type: 'app.bsky.actor.defs#postInteractionSettingsPref',
      }

      /**
       * Matches handling of `threadgate.allow` where `undefined` means "everyone"
       */
      pref.threadgateAllowRules = settings.threadgateAllowRules
      pref.postgateEmbeddingRules = settings.postgateEmbeddingRules

      return prefs
        .filter((p) => !AppBskyActorDefs.isPostInteractionSettingsPref(p))
        .concat(pref)
    })
  }

  async setVerificationPrefs(settings: AppBskyActorDefs.VerificationPrefs) {
    const result = AppBskyActorDefs.validateVerificationPrefs(settings)
    // Fool-proofing (should not be needed because of type safety)
    if (!result.success) throw result.error

    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(predicate.isValidVerificationPrefs) || {
        $type: 'app.bsky.actor.defs#verificationPrefs',
        hideBadges: false,
      }

      pref.hideBadges = settings.hideBadges

      return prefs
        .filter((p) => !AppBskyActorDefs.isVerificationPrefs(p))
        .concat(pref)
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
    await this.updatePreferences((prefs) => {
      const pref = prefs.findLast(predicate.isValidHiddenPostsPref) || {
        $type: 'app.bsky.actor.defs#hiddenPostsPref',
        items: [],
      }

      const hiddenItems = new Set(pref.items)

      if (action === 'hide') hiddenItems.add(postUri)
      else hiddenItems.delete(postUri)

      pref.items = [...hiddenItems]

      return prefs
        .filter((p) => !AppBskyActorDefs.isHiddenPostsPref(p))
        .concat(pref)
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
    await this.updatePreferences((prefs) => {
      const feedsPref = prefs.findLast(predicate.isValidSavedFeedsPref) || {
        $type: 'app.bsky.actor.defs#savedFeedsPref',
        saved: [],
        pinned: [],
      }

      res = cb(feedsPref.saved, feedsPref.pinned)
      feedsPref.saved = res.saved
      feedsPref.pinned = res.pinned

      return prefs
        .filter((pref) => !AppBskyActorDefs.isSavedFeedsPref(pref))
        .concat(feedsPref)
    })
    return res
  }

  private async updateSavedFeedsV2Preferences(
    cb: (
      savedFeedsPref: AppBskyActorDefs.SavedFeed[],
    ) => AppBskyActorDefs.SavedFeed[],
  ): Promise<AppBskyActorDefs.SavedFeed[]> {
    let maybeMutatedSavedFeeds: AppBskyActorDefs.SavedFeed[] = []

    await this.updatePreferences((prefs) => {
      const existingV2Pref = prefs.findLast(
        predicate.isValidSavedFeedsPrefV2,
      ) || {
        $type: 'app.bsky.actor.defs#savedFeedsPrefV2',
        items: [],
      }

      const newSavedFeeds = cb(existingV2Pref.items)

      // enforce ordering: pinned first, then saved
      existingV2Pref.items = [...newSavedFeeds].sort((a, b) =>
        // @NOTE: preserve order of items with the same pinned status
        a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1,
      )

      // Store the return value
      maybeMutatedSavedFeeds = newSavedFeeds

      let updatedPrefs = prefs
        .filter((pref) => !AppBskyActorDefs.isSavedFeedsPrefV2(pref))
        .concat(existingV2Pref)

      /*
       * If there's a v2 pref present, it means this account was migrated from v1
       * to v2. During the transition period, we double write v2 prefs back to
       * v1, but NOT the other way around.
       */
      let existingV1Pref = prefs.findLast(predicate.isValidSavedFeedsPref)
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
  const labelersPref = prefs.findLast(predicate.isValidLabelersPref)
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
