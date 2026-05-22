import { AppContext } from '../context'
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
 * - Subscribing the account to the configured default lists
 *   (e.g. "W Social Users" feed), driven by PDS_WSOCIAL_DEFAULT_SUBSCRIBE_LISTS.
 * - Setting the default thread-view preferences, driven by
 *   PDS_WSOCIAL_DEFAULT_THREAD_PREF.
 *
 * Both steps are non-fatal: failures are logged but do not abort account
 * creation.  Call this from every account-creation flow so all users receive
 * the same out-of-the-box experience.
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
  // Subscribe to default lists (e.g. "W Social Users" feed)
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
