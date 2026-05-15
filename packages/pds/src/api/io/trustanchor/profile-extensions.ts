import type { AppContext } from '../../../context'
import type { ProfileViewDetailed } from '../../../lexicon/types/app/bsky/actor/defs'

/**
 * Add W Social platform extensions to a profile.
 * Only applies to accounts hosted on this PDS.
 *
 * Extensions:
 * - wsocialAccountType: 'human' | 'test' | 'organization' | 'bot'
 * - wsocialVerified: 'wid' | 'admin' | null
 */
export async function addWSocialExtensions(
  ctx: AppContext,
  profile: ProfileViewDetailed,
): Promise<
  ProfileViewDetailed & {
    wsocialAccountType?: string
    wsocialVerified?: string | null
  }
> {
  try {
    // Check if account exists on this PDS
    const account = await ctx.accountManager.getAccount(profile.did, {
      includeDeactivated: true,
    })

    if (!account) {
      // Not a local account - return profile unchanged
      return profile
    }

    // Read accountType directly from actor table (set at creation, managed via admin API)
    const actorRow = await ctx.accountManager.db.db
      .selectFrom('actor')
      .select(['accountType'])
      .where('did', '=', profile.did)
      .executeTakeFirst()

    // Map 'personal' -> 'human' for external API backward compatibility
    const rawType = actorRow?.accountType ?? 'bot'
    const wsocialAccountType = rawType === 'personal' ? 'human' : rawType

    // Derive wsocialVerified from accountType
    const wsocialVerified =
      rawType === 'unverified' ? null : rawType === 'personal' ? 'wid' : 'admin'

    // Return profile with W Social extensions
    return {
      ...profile,
      wsocialAccountType,
      wsocialVerified,
    }
  } catch (error) {
    // On any error, silently return original profile without extensions
    // This prevents breaking the endpoint due to transient DB issues
    console.error('Error adding W Social extensions to profile:', error)
    return profile
  }
}
