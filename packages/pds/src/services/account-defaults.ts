import { AppContext } from '../context'
import { subscribeToFeeds } from './feed-subscription'
import { subscribeToLists } from './list-subscription'
import { setThreadViewPreferences } from './thread-preferences'

type Logger = {
  info: (obj: Record<string, unknown>, msg: string) => void
  error: (obj: Record<string, unknown>, msg: string) => void
}

/**
 * Apply W Social default settings to a newly created account.
 *
 * This covers:
 * - Subscribing the account to the configured default feed-generator feeds
 *   (e.g. the W Social Users feed), driven by
 *   PDS_WSOCIAL_DEFAULT_SUBSCRIBE_FEEDS. Runs FIRST so feeds sit at the
 *   front of the home-tab order, immediately after the `following`
 *   timeline that `subscribeToFeeds` repairs onto the front of the
 *   `savedFeedsPrefV2`.
 * - Subscribing to the configured default lists, driven by
 *   PDS_WSOCIAL_DEFAULT_SUBSCRIBE_LISTS. Lists are pushed onto the end of
 *   the saved-feeds array — after feeds in the tab order.
 * - Setting the default thread-view preferences, driven by
 *   PDS_WSOCIAL_DEFAULT_THREAD_PREF.
 *
 * Each step is non-fatal: failures are logged but do not abort account
 * creation. Call this from every account-creation flow (standard signup +
 * QuickLogin) so all users receive the same out-of-the-box experience.
 *
 * Env config lives in the PDS Secret (`existingSecret: pds` in the infra
 * chart), read once at boot — set the new values there and `kubectl
 * rollout restart statefulset/pds` to pick them up. No image rebuild
 * required, unlike the next-js build-time EXPO_PUBLIC_* vars.
 *
 * @param ctx - Application context
 * @param did - DID of the newly created account
 * @param log - Optional logger (pino instance or compatible object)
 */
export async function applyNewAccountDefaults(
  ctx: AppContext,
  did: string,
  log?: Logger,
): Promise<void> {
  // Subscribe to default feed-generator feeds (e.g. the W Social Users
  // feed). Done before lists so feeds appear ahead of lists in the
  // resulting tab order.
  if (ctx.cfg.wsocial.defaultSubscribeFeeds.length > 0) {
    try {
      const subscribedCount = await subscribeToFeeds(
        ctx,
        did,
        ctx.cfg.wsocial.defaultSubscribeFeeds,
      )
      log?.info({ did, subscribedCount }, 'Subscribed new account to default feeds')
    } catch (err) {
      log?.error({ err, did }, 'Failed to subscribe account to default feeds')
    }
  }

  // Subscribe to default lists
  if (ctx.cfg.wsocial.defaultSubscribeLists.length > 0) {
    try {
      const subscribedCount = await subscribeToLists(
        ctx,
        did,
        ctx.cfg.wsocial.defaultSubscribeLists,
      )
      log?.info({ did, subscribedCount }, 'Subscribed new account to default lists')
    } catch (err) {
      log?.error({ err, did }, 'Failed to subscribe account to default lists')
    }
  }

  // Set default thread view preferences
  if (ctx.cfg.wsocial.defaultThreadPref.enabled) {
    try {
      await setThreadViewPreferences(ctx, did, {
        treeViewEnabled: ctx.cfg.wsocial.defaultThreadPref.treeViewEnabled,
        sort: ctx.cfg.wsocial.defaultThreadPref.sort,
      })
      log?.info({ did }, 'Set default thread view preferences for new account')
    } catch (err) {
      log?.error({ err, did }, 'Failed to set thread view preferences')
    }
  }
}
