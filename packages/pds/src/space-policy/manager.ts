import type { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import type { DidString, SpaceRefString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { ActorStore } from '../actor-store/actor-store.js'
import {
  resolveNotifyTarget,
  toSpaceRef,
} from '../api/com/atproto/space/util.js'
import { com } from '../lexicons/index.js'
import { spaceLogger } from '../logger.js'
import {
  type LexPolicy,
  type Policy,
  areMembersPublished,
  assertMemberspace,
  isAppAuthorized,
  isPublicRead,
  normalizePolicy,
} from './policy.js'
import {
  prepareMemberListWrites,
  prepareMemberRecordWrites,
  preparePolicyRecordWrites,
} from './publish.js'

const { personalspace, memberspace, managedspace } = com.atproto

type Access = 'read' | 'write'

export class SpacePolicyManager {
  constructor(
    public actorStore: ActorStore,
    public idResolver: IdResolver,
  ) {}

  // The methods that change a space's configuration also publish it to readers when
  // the policy asks for it. They return the commit to the authority's repo, which is
  // owed a notifyWrite, or null if nothing was published.

  async createSpace(space: SpaceRefString, policy: LexPolicy) {
    const { spaceDid } = toSpaceRef(space)
    const normalized = normalizePolicy(policy)
    return this.actorStore.transact(spaceDid, async (actorTxn) => {
      const existing = await actorTxn.space.getSpacePolicy(space)
      if (existing) {
        throw new InvalidRequestError(
          'Space already exists',
          'SpaceAlreadyExists',
        )
      }
      await actorTxn.space.createSpace(space, normalized)
      const writes = await preparePolicyRecordWrites(
        actorTxn.space,
        space,
        normalized,
      )
      return actorTxn.space.applyWrites(space, writes)
    })
  }

  /**
   * Replaces the policy wholesale. A policy of the same `$type` is a configuration
   * change. A different `$type` migrates the space: state held by the previous
   * policy is discarded, so migrating back does not restore it.
   */
  async updateSpace(space: SpaceRefString, policy: LexPolicy) {
    const { spaceDid } = toSpaceRef(space)
    const next = normalizePolicy(policy)
    return this.actorStore.transact(spaceDid, async (actorTxn) => {
      const current = await actorTxn.space.getActiveSpacePolicy(space)

      const writes = await preparePolicyRecordWrites(
        actorTxn.space,
        space,
        next,
      )
      // Only memberspace has a member list, so this also withdraws a published
      // list when a migration discards it.
      if (areMembersPublished(current) !== areMembersPublished(next)) {
        const memberWrites = await prepareMemberListWrites(
          actorTxn.space,
          space,
          next,
        )
        writes.push(...memberWrites)
      }

      await actorTxn.space.updateSpacePolicy(space, next)
      if (current.$type !== next.$type) {
        await actorTxn.space.removeAllMembers(space)
      }
      return actorTxn.space.applyWrites(space, writes)
    })
  }

  async putMember(
    space: SpaceRefString,
    did: DidString,
    access: { read: boolean; write: boolean },
  ) {
    const { spaceDid } = toSpaceRef(space)
    return this.actorStore.transact(spaceDid, async (actorTxn) => {
      const policy = await actorTxn.space.getActiveSpacePolicy(space)
      assertMemberspace(policy)
      await actorTxn.space.putMember(space, did, access)
      const writes = await prepareMemberRecordWrites(
        actorTxn.space,
        space,
        policy,
        did,
        access,
      )
      return actorTxn.space.applyWrites(space, writes)
    })
  }

  async removeMember(space: SpaceRefString, did: DidString) {
    const { spaceDid } = toSpaceRef(space)
    return this.actorStore.transact(spaceDid, async (actorTxn) => {
      const policy = await actorTxn.space.getActiveSpacePolicy(space)
      assertMemberspace(policy)
      await actorTxn.space.removeMember(space, did)
      const writes = await prepareMemberRecordWrites(
        actorTxn.space,
        space,
        policy,
        did,
      )
      return actorTxn.space.applyWrites(space, writes)
    })
  }

  async getSpace(space: SpaceRefString) {
    const { spaceDid } = toSpaceRef(space)
    const policy = await this.actorStore.read(spaceDid, (store) =>
      store.space.getActiveSpacePolicy(space),
    )
    return { uri: space, policy }
  }

  /**
   * Both perimeters a credential has to clear. The app goes first because it decides
   * from the policy alone, so a refused app is never disclosed to a third-party
   * managing app.
   *
   * `userDid` is absent when the request carries no delegation token, which only a
   * space with public read access accepts. Any other space answers as though it
   * does not exist, so a request without a token can't learn that it does.
   */
  async authorizeCredential(opts: {
    space: SpaceRefString
    policy: Policy
    userDid?: string
    clientId?: string
  }): Promise<void> {
    const { space, policy, userDid, clientId } = opts

    if (!userDid && !isPublicRead(policy)) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }

    if (!isAppAuthorized(policy, clientId)) {
      throw new InvalidRequestError(
        'Application not authorized for this space',
        'AppNotAuthorized',
      )
    }

    if (!userDid) return

    const authorized = await this.authorizeUser({
      space,
      policy,
      userDid,
      access: 'read',
      clientId,
    })
    if (!authorized) {
      throw new InvalidRequestError(
        'User not authorized for this space',
        'UserNotAuthorized',
      )
    }
  }

  async authorizeUser(opts: {
    space: SpaceRefString
    policy: Policy
    userDid: string
    access: Access
    clientId?: string
  }): Promise<boolean> {
    const { space, policy, userDid, access, clientId } = opts
    const { spaceDid } = toSpaceRef(space)

    // Under every policy the authority is authorized. It is the only party who can
    // reconfigure the space, so it must not be able to lock itself out.
    if (userDid === spaceDid) return true

    if (personalspace.policy.$isTypeOf(policy)) {
      return false
    }
    if (memberspace.policy.$isTypeOf(policy)) {
      const level = access === 'read' ? policy.readAccess : policy.writeAccess
      if (level === 'public') return true
      const member = await this.actorStore.read(spaceDid, (store) =>
        store.space.getMember(space, userDid),
      )
      if (!member) return false
      if (access === 'read') return !!member.read
      return !!member.write
    }
    if (managedspace.policy.$isTypeOf(policy)) {
      return this.checkManagingApp({
        space,
        spaceDid,
        userDid,
        access,
        managingApp: policy.managingApp,
        clientId,
      })
    }
    return false
  }

  /**
   * Deletes the authority's own repo in the space along with it: no other party's data
   * is involved. A member's records stay where they are, as records nobody can obtain
   * a credential to read — their PDS is not notified, and the application is what
   * tells the user their space is gone.
   *
   * The space row stays as a tombstone so getSpaceCredential keeps answering
   * SpaceDeleted, which is how a syncer that missed the notification finds out.
   *
   * Returns the syncers registered at the time of deletion, which are owed a
   * notifySpaceDeleted.
   */
  async deleteSpace(
    space: SpaceRefString,
  ): Promise<{ serviceDid: string; expiresAt: string }[]> {
    const { spaceDid } = toSpaceRef(space)
    return this.actorStore.transact(spaceDid, async (actorTxn) => {
      const recipients = await actorTxn.space.getCredentialRecipients(space)
      await actorTxn.space.deleteSpace(space)
      return recipients
    })
  }

  private async checkManagingApp(opts: {
    space: SpaceRefString
    spaceDid: DidString
    userDid: string
    access: Access
    managingApp: string
    clientId?: string
  }): Promise<boolean> {
    const { space, spaceDid, userDid, access, managingApp, clientId } = opts

    const lxm = com.atproto.managedspace.checkUserAccess.$lxm
    try {
      const target = await resolveNotifyTarget(this, {
        iss: spaceDid,
        service: managingApp,
        lxm,
      })
      if (!target) {
        spaceLogger.warn(
          { space, managingApp },
          'could not resolve managing app',
        )
        return false
      }
      const res = await xrpc(
        target.endpoint,
        com.atproto.managedspace.checkUserAccess,
        {
          headers: target.headers,
          params: {
            space,
            user: userDid as DidString,
            access,
            clientId,
          },
        },
      )
      return res.body.authorized === true
    } catch (err) {
      // An unreachable managing app denies: failing open would hand out credentials
      // for the spaces that asked for the strictest gate.
      spaceLogger.warn(
        { err, space, managingApp, user: userDid },
        'managing app check failed',
      )
      return false
    }
  }
}
