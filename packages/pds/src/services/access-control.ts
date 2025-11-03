import { ActorStore } from '../actor-store/actor-store'

export interface AccessResult {
  canView: boolean
  isPrivate: boolean
  isOwnProfile: boolean
}

export interface PrivacySettings {
  isPrivate: boolean
}

export class AccessControlService {
  constructor(private actorStore: ActorStore) {}

  /**
   * Check if a requester can view a subject's profile content
   * @param requester - DID of the requesting user (null for unauthenticated)
   * @param subject - DID of the profile being accessed
   * @returns AccessResult indicating if the requester can view the profile
   */
  async canViewProfile(
    requester: string | null,
    subject: string,
  ): Promise<AccessResult> {
    // Check if subject profile is private
    const privacySettings = await this.getPrivacySettings(subject)

    // If profile is not private, anyone can view
    if (!privacySettings.isPrivate) {
      return {
        canView: true,
        isPrivate: false,
        isOwnProfile: requester === subject,
      }
    }

    // Profile is private - check authorization
    // If no requester (unauthenticated), deny access
    if (!requester) {
      return {
        canView: false,
        isPrivate: true,
        isOwnProfile: false,
      }
    }

    // If requester is the profile owner, grant access
    if (requester === subject) {
      return {
        canView: true,
        isPrivate: true,
        isOwnProfile: true,
      }
    }

    // Check if requester has an approved follow record
    const hasFollow = await this.checkFollowRecord(requester, subject)

    return {
      canView: hasFollow,
      isPrivate: true,
      isOwnProfile: false,
    }
  }

  /**
   * Get privacy settings for a user
   * @param did - DID of the user
   * @returns Privacy settings including isPrivate flag
   */
  async getPrivacySettings(did: string): Promise<PrivacySettings> {
    try {
      const prefs = await this.actorStore.read(did, async (store) => {
        return await store.pref.getPreferences('app.bsky', {
          hasAccessFull: true,
        })
      })

      // Find the privateProfilePref preference
      const privateProfilePref = prefs.find(
        (pref) => pref.$type === 'app.bsky.actor.defs#privateProfilePref',
      ) as { $type: string; isPrivate?: boolean } | undefined

      return {
        isPrivate: privateProfilePref?.isPrivate ?? false,
      }
    } catch (error) {
      // If we can't read preferences (e.g., user doesn't exist), assume public
      return {
        isPrivate: false,
      }
    }
  }

  /**
   * Check if requester has a follow record for the subject
   * @param requester - DID of the requester
   * @param subject - DID of the subject being followed
   * @returns true if follow record exists, false otherwise
   */
  private async checkFollowRecord(
    requester: string,
    subject: string,
  ): Promise<boolean> {
    try {
      const backlinks = await this.actorStore.read(requester, async (store) => {
        return await store.record.getRecordBacklinks({
          collection: 'app.bsky.graph.follow',
          path: 'subject',
          linkTo: subject,
        })
      })

      return backlinks.length > 0
    } catch (error) {
      // If we can't read backlinks, assume no follow exists
      return false
    }
  }
}

