import type { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import type { SpaceMetaArchive } from '@atproto/space'
import type { DidString, SpaceRef, UriString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { ActorStore } from '../actor-store/actor-store.js'
import { resolveNotifyTarget } from '../api/com/atproto/space/util.js'
import { com } from '../lexicons/index.js'
import { spaceLogger } from '../logger.js'
import type { PreparedWrite } from '../repo/types.js'
import { memberStateEntry, parsePolicyState } from './archive.js'
import {
  type LexPolicy,
  type Policy,
  areMembersPublished,
  assertMemberspace,
  isAppAuthorized,
  normalizePolicy,
  parseArchivedPolicy,
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
  // owed a notifyRepoUpdate, or null if nothing was published.

  async createSpace(ref: SpaceRef, policy: LexPolicy) {
    const normalized = normalizePolicy(policy)
    return this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      const existing = await actorTxn.space.getSpacePolicy(ref.toString())
      if (existing) {
        throw new InvalidRequestError(
          'Space already exists',
          'SpaceAlreadyExists',
        )
      }
      await actorTxn.space.createSpace(ref, normalized)
      const writes = await preparePolicyRecordWrites(
        actorTxn.space,
        ref,
        normalized,
      )
      return actorTxn.space.applyWrites(ref, writes)
    })
  }

  /**
   * Replaces the policy wholesale. A policy of the same `$type` is a configuration
   * change. A different `$type` migrates the space: state held by the previous
   * policy is discarded, so migrating back does not restore it.
   */
  async updateSpace(ref: SpaceRef, policy: LexPolicy) {
    const space = ref.toString()
    const next = normalizePolicy(policy)
    return this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      const current = await actorTxn.space.getActiveSpacePolicy(space)

      const writes = await preparePolicyRecordWrites(actorTxn.space, ref, next)
      // Only memberspace has a member list, so this also withdraws a published
      // list when a migration discards it.
      if (areMembersPublished(current) !== areMembersPublished(next)) {
        const memberWrites = await prepareMemberListWrites(
          actorTxn.space,
          ref,
          next,
        )
        writes.push(...memberWrites)
      }

      await actorTxn.space.updateSpacePolicy(space, next)
      if (current.$type !== next.$type) {
        await actorTxn.space.removeAllMembers(space)
      }
      return actorTxn.space.applyWrites(ref, writes)
    })
  }

  async putMembers(
    ref: SpaceRef,
    members: com.atproto.memberspace.defs.Member[],
  ) {
    const space = ref.toString()
    // Keyed by DID, so that a DID listed twice takes its last entry rather than
    // having its record written twice in the same commit.
    const accessByDid = new Map(
      members.map(({ did, read, write }) => [did, { read, write }]),
    )
    return this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      const policy = await actorTxn.space.getActiveSpacePolicy(space)
      assertMemberspace(policy)
      const writes: PreparedWrite[] = []
      for (const [did, access] of accessByDid) {
        await actorTxn.space.putMember(space, did, access)
        if (!access.write) {
          await actorTxn.space.removeWriter(space, did)
        }
        const memberWrites = await prepareMemberRecordWrites(
          actorTxn.space,
          ref,
          policy,
          did,
          access,
        )
        writes.push(...memberWrites)
      }
      return actorTxn.space.applyWrites(ref, writes)
    })
  }

  async removeMembers(ref: SpaceRef, dids: DidString[]) {
    const space = ref.toString()
    return this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      const policy = await actorTxn.space.getActiveSpacePolicy(space)
      assertMemberspace(policy)
      const writes: PreparedWrite[] = []
      for (const did of dids) {
        // A DID that is not a member is ignored, leaving any writer set entry alone.
        const removed = await actorTxn.space.removeMember(space, did)
        if (!removed) continue
        await actorTxn.space.removeWriter(space, did)
        const memberWrites = await prepareMemberRecordWrites(
          actorTxn.space,
          ref,
          policy,
          did,
        )
        writes.push(...memberWrites)
      }
      return actorTxn.space.applyWrites(ref, writes)
    })
  }

  async getSpace(ref: SpaceRef) {
    const space = ref.toString()
    const policy = await this.actorStore.read(ref.spaceDid, (store) =>
      store.space.getActiveSpacePolicy(space),
    )
    return { space, policy }
  }

  /** The space's host-side state, for migrating its authority's account. */
  async exportSpaceMeta(ref: SpaceRef): Promise<SpaceMetaArchive> {
    const space = ref.toString()
    return this.actorStore.read(ref.spaceDid, async (store) => {
      const policy = await store.space.getActiveSpacePolicy(space)
      const members = memberspace.policy.$isTypeOf(policy)
        ? await store.space.listMembers(space)
        : []
      const writers = await store.space.listWriters(space)
      return {
        space,
        policy,
        policyState: members.map((member) =>
          memberStateEntry({
            did: member.did,
            access: { read: !!member.read, write: !!member.write },
          }),
        ),
        writers: writers.map((writer) => ({
          did: writer.did,
          repoRev: writer.repoRev,
          data: writer.data,
          spaceRev: writer.spaceRev,
        })),
      }
    })
  }

  /**
   * Import a space exported by its previous host, as its authority's account
   * migrates here, replacing whatever this host held for it. The policy and member
   * list are published to readers by records in the authority's repo, which
   * arrives afterwards with importRepo, so nothing is published here.
   */
  async importSpaceMeta(
    ref: SpaceRef,
    archive: SpaceMetaArchive,
  ): Promise<void> {
    const space = ref.toString()
    const policy = parseArchivedPolicy(archive.policy)
    const members = parsePolicyState(policy, archive.policyState)
    await this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      await actorTxn.space.createSpace(ref, policy)
      await actorTxn.space.removeAllMembers(space)
      for (const { did, access } of members) {
        await actorTxn.space.putMember(space, did, access)
      }
      await actorTxn.space.importWriters(space, archive.writers)
    })
  }

  /**
   * Both perimeters a credential has to clear. The account goes first, and an
   * account the policy refuses is answered as though the space does not exist, so
   * that a refusal discloses nothing about the space to someone without access to it.
   *
   * `repo` is absent when the request carries no delegation token.
   */
  async authorizeCredential(opts: {
    space: SpaceRef
    policy: Policy
    repo?: DidString
    clientId?: UriString
  }): Promise<void> {
    const { space, policy, repo, clientId } = opts

    const repoAuthorized = await this.authorizeRepo({
      space,
      policy,
      repo,
      access: 'read',
      clientId,
    })
    if (!repoAuthorized) {
      throw new InvalidRequestError('Space not found', 'SpaceNotFound')
    }

    if (!isAppAuthorized(policy, clientId)) {
      throw new InvalidRequestError(
        'Application not authorized for this space',
        'AppNotAuthorized',
      )
    }
  }

  /**
   * Whether the policy authorizes an account to read or write. `repo` is absent for a
   * read with no delegation token, which a policy authorizes only if it does not gate
   * on the account.
   */
  async authorizeRepo(opts: {
    space: SpaceRef
    policy: Policy
    repo?: DidString
    access: Access
    clientId?: UriString
  }): Promise<boolean> {
    const { space, policy, repo, access, clientId } = opts
    const { spaceDid } = space

    // Under every policy the authority is authorized. It is the only party who can
    // reconfigure the space, so it must not be able to lock itself out.
    if (repo === spaceDid) return true

    if (personalspace.policy.$isTypeOf(policy)) {
      return false
    }
    if (memberspace.policy.$isTypeOf(policy)) {
      const isPublic =
        access === 'read' ? policy.publicRead : policy.publicWrite
      if (isPublic) return true
      if (!repo) return false
      const member = await this.actorStore.read(spaceDid, (store) =>
        store.space.getMember(space.toString(), repo),
      )
      if (!member) return false
      if (access === 'read') return !!member.read
      return !!member.write
    }
    if (managedspace.policy.$isTypeOf(policy)) {
      const managedAccess = await this.checkAccess({
        space,
        managingApp: policy.managingApp,
        repo,
        clientId,
      })
      return managedAccess[access]
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
   * notifySpaceStatus.
   */
  async deleteSpace(
    ref: SpaceRef,
  ): Promise<{ service: string; expiresAt: string }[]> {
    const space = ref.toString()
    return this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      const recipients = await actorTxn.space.getCredentialRecipients(space)
      await actorTxn.space.deleteSpace(space)
      return recipients
    })
  }

  /**
   * Ask a managed space's managing app for an account's access. `repo` is absent for
   * a read with no delegation token, and `clientId` is absent for writes, since a
   * repo update notification does not identify the app that made the write.
   */
  private async checkAccess(opts: {
    space: SpaceRef
    managingApp: string
    repo?: DidString
    clientId?: UriString
  }): Promise<{ read: boolean; write: boolean }> {
    const { managingApp, repo, clientId } = opts
    const space = opts.space.toString()

    const lxm = com.atproto.managedspace.checkAccess.$lxm
    try {
      const target = await resolveNotifyTarget(this, {
        iss: opts.space.spaceDid,
        service: managingApp,
        lxm,
      })
      if (!target) {
        spaceLogger.warn(
          { space, managingApp },
          'could not resolve managing app',
        )
        return { read: false, write: false }
      }
      const res = await xrpc(
        target.endpoint,
        com.atproto.managedspace.checkAccess,
        {
          headers: target.headers,
          params: { space, repo, clientId },
        },
      )
      return { read: res.body.read, write: res.body.write }
    } catch (err) {
      // An unreachable managing app denies: failing open would hand out credentials
      // for the spaces that asked for the strictest gate.
      spaceLogger.warn(
        { err, space, managingApp, repo },
        'managing app check failed',
      )
      return { read: false, write: false }
    }
  }
}
