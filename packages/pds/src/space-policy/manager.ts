import type { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex-client'
import type { SpaceMetaArchive } from '@atproto/space'
import type { DidString, SpaceRef, UriString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Fetch } from '@atproto-labs/fetch-node'
import type { ActorStore } from '../actor-store/actor-store.js'
import {
  type RemovedWriter,
  resolveNotifyTarget,
} from '../api/com/atproto/space/util.js'
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
    public safeFetch: Fetch,
  ) {}

  // The methods that change a space's configuration also publish it to readers when
  // the policy asks for it. They return the commit to the authority's repo, which is
  // owed a notifyRepoUpdate, or null if nothing was published. The methods that
  // manage members also return the writers they removed, whose removal is owed to
  // registered syncers.

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
      const removedWriters: RemovedWriter[] = []
      for (const [did, access] of accessByDid) {
        await actorTxn.space.putMember(space, did, access)
        if (!access.write) {
          const removed = await actorTxn.space.removeWriter(space, did)
          if (removed) removedWriters.push({ repo: did, ...removed })
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
      const commit = await actorTxn.space.applyWrites(ref, writes)
      return { commit, removedWriters }
    })
  }

  async removeMembers(ref: SpaceRef, dids: DidString[]) {
    const space = ref.toString()
    return this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      const policy = await actorTxn.space.getActiveSpacePolicy(space)
      assertMemberspace(policy)
      const writes: PreparedWrite[] = []
      const removedWriters: RemovedWriter[] = []
      for (const did of dids) {
        // A DID that is not a member is ignored, leaving any writer set entry alone.
        const wasMember = await actorTxn.space.removeMember(space, did)
        if (!wasMember) continue
        const removed = await actorTxn.space.removeWriter(space, did)
        if (removed) removedWriters.push({ repo: did, ...removed })
        const memberWrites = await prepareMemberRecordWrites(
          actorTxn.space,
          ref,
          policy,
          did,
        )
        writes.push(...memberWrites)
      }
      const commit = await actorTxn.space.applyWrites(ref, writes)
      return { commit, removedWriters }
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
      // Removed writers are left behind, as the archive carries only the writer set
      // itself. Like garbage collection, this drops removals not yet seen by syncers.
      const writers = (await store.space.listWriters(space)).filter(
        (writer) => !writer.removedAt,
      )
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
      if (access === 'read' && policy.publicRead) return true
      if (!repo) return false
      const member = await this.actorStore.read(spaceDid, (store) =>
        store.space.getMember(space.toString(), repo),
      )
      if (access === 'read') return !!member?.read
      // A member without write access stays excluded even under publicWrite.
      if (member) return !!member.write
      return policy.publicWrite === true
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
   * The space row stays as a tombstone so authorizeSpaceSync keeps answering
   * SpaceDeleted, which is how a syncer that missed the notification finds out.
   *
   * Returns the syncers registered at the time of deletion, including lapsed
   * registrations, which are owed a deletion notice.
   */
  async deleteSpace(
    ref: SpaceRef,
  ): Promise<{ endpoint: string; token: string }[]> {
    const space = ref.toString()
    return this.actorStore.transact(ref.spaceDid, async (actorTxn) => {
      const registrations = await actorTxn.space.getNotifyRegistrations(space)
      await actorTxn.space.deleteSpace(space)
      return registrations
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
        { service: target.endpoint, fetch: this.safeFetch },
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
