import { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import { DidString, SpaceRefString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ActorStore } from '../actor-store/actor-store.js'
import { SpaceRow } from '../actor-store/space/index.js'
import {
  resolveNotifyTarget,
  toSpaceRef,
} from '../api/com/atproto/space/util.js'
import { BackgroundQueue } from '../background.js'
import { com } from '../lexicons/index.js'
import { spaceLogger } from '../logger.js'
import { appAccessToStorage, policyToStorage, toLexConfig } from './config.js'

type LexPolicy = com.atproto.simplespace.createSpace.$InputBody['policy']
type LexAppAccess = com.atproto.simplespace.createSpace.$InputBody['appAccess']

export class SimpleSpaceManager {
  constructor(
    public actorStore: ActorStore,
    public idResolver: IdResolver,
    private backgroundQueue: BackgroundQueue,
  ) {}

  async createSpace(
    space: SpaceRefString,
    config: { policy: LexPolicy; appAccess: LexAppAccess },
  ): Promise<void> {
    const { spaceDid } = toSpaceRef(space)
    const columns = {
      ...policyToStorage(config.policy),
      ...appAccessToStorage(config.appAccess),
    }

    await this.actorStore.transact(spaceDid, async (actorTxn) => {
      const existing = await actorTxn.space.getSpace(space)
      if (existing && !existing.deletedAt) {
        throw new InvalidRequestError(
          'Space already exists',
          'SpaceAlreadyExists',
        )
      }
      await actorTxn.space.createSpace(space, columns)
      // The authority is a member of its own space.
      await actorTxn.space.addMember(space, spaceDid)
    })
  }

  async updateSpace(
    space: SpaceRefString,
    patch: { policy?: LexPolicy; appAccess?: LexAppAccess },
  ): Promise<void> {
    const config = {
      ...(patch.policy && policyToStorage(patch.policy)),
      ...(patch.appAccess && appAccessToStorage(patch.appAccess)),
    }
    const { spaceDid } = toSpaceRef(space)
    await this.actorStore.transact(spaceDid, async (actorTxn) => {
      await actorTxn.space.getActiveSpace(space)
      await actorTxn.space.updateSpaceConfig(space, config)
    })
  }

  async getSpace(space: SpaceRefString) {
    const { spaceDid } = toSpaceRef(space)
    const spaceRow = await this.actorStore
      .read(spaceDid, (store) => store.space.getActiveSpace(space))
      .catch(asSpaceNotFound)
    return toLexConfig(spaceRow)
  }

  /**
   * Resolve a `checkUserAuthorized` result that the store couldn't answer alone, by
   * asking the space's managing app. Callers read the space from a store they already
   * hold open, so the local decision doesn't come back through here.
   */
  async authorizeUser(opts: {
    space: SpaceRow
    checked: boolean | 'ask-managing-app'
    userDid: string
    clientId?: string
  }): Promise<boolean> {
    const { space, checked, userDid, clientId } = opts
    if (checked !== 'ask-managing-app') return checked
    const { spaceDid } = toSpaceRef(space.uri)
    return this.checkManagingApp({ space, spaceDid, userDid, clientId })
  }

  /**
   * Deletes the authority's own repo in the space along with it: no other party's data
   * is involved. Other members' hosts flag theirs on notifySpaceDeleted.
   *
   * The space row stays as a tombstone so getSpaceCredential keeps answering
   * SpaceDeleted, which is how a syncer that missed the notification finds out.
   */
  async deleteSpace(space: SpaceRefString): Promise<void> {
    const { spaceDid } = toSpaceRef(space)

    const recipients = await this.actorStore.transact(
      spaceDid,
      async (actorTxn) => {
        const recipients = await actorTxn.space.listDeletionRecipients(space)
        await actorTxn.space.markSpaceDeleted(space)
        await actorTxn.space.purgeSpaceData(space)
        return recipients
      },
    )

    this.backgroundQueue.add(() =>
      this.notifySpaceDeleted(space, spaceDid, recipients),
    )
  }

  private async notifySpaceDeleted(
    space: SpaceRefString,
    spaceDid: DidString,
    recipients: { writers: DidString[]; services: string[] },
  ): Promise<void> {
    // A bare DID resolves to that account's PDS, and `repo` tells it which of its
    // accounts to flag. A registered syncer names its own service entry and drops the
    // space entirely, so it needs no repo.
    const targets = [
      ...recipients.writers.map((did) => ({ service: did, repo: did })),
      ...recipients.services.map((service) => ({ service, repo: undefined })),
    ]

    const lxm = com.atproto.space.notifySpaceDeleted.$lxm
    for (const { service, repo } of targets) {
      // Best effort: a recipient that misses this learns the space is gone from
      // SpaceDeleted on its next credential renewal.
      try {
        const target = await resolveNotifyTarget(this, {
          iss: spaceDid,
          service,
          lxm,
        })
        if (!target) {
          spaceLogger.warn(
            { space, service, lxm },
            'could not resolve recipient',
          )
          continue
        }
        await xrpc(target.endpoint, com.atproto.space.notifySpaceDeleted, {
          headers: target.headers,
          body: { space, repo },
        })
      } catch (err) {
        spaceLogger.warn({ err, space, service, lxm }, 'notify failed')
      }
    }
  }

  private async checkManagingApp(opts: {
    space: SpaceRow
    spaceDid: DidString
    userDid: string
    clientId?: string
  }): Promise<boolean> {
    const { space, spaceDid, userDid, clientId } = opts
    const { managingApp } = space
    if (!managingApp) return false
    const lxm = com.atproto.simplespace.checkUserAccess.$lxm
    try {
      const target = await resolveNotifyTarget(this, {
        iss: spaceDid,
        service: managingApp,
        lxm,
      })
      if (!target) {
        spaceLogger.warn(
          { space: space.uri, managingApp },
          'could not resolve managing app',
        )
        return false
      }
      const res = await xrpc(
        target.endpoint,
        com.atproto.simplespace.checkUserAccess,
        {
          headers: target.headers,
          params: {
            space: space.uri,
            user: userDid as DidString,
            clientId,
          },
        },
      )
      return res.body.authorized === true
    } catch (err) {
      // An unreachable managing app denies: failing open would hand out credentials
      // for the spaces that asked for the strictest gate.
      spaceLogger.warn(
        { err, space: space.uri, managingApp, user: userDid },
        'managing app check failed',
      )
      return false
    }
  }
}

// A space is read out of its authority's own store, so a host that doesn't hold that
// account can't answer for it.
function asSpaceNotFound(err: unknown): never {
  if (
    err instanceof InvalidRequestError &&
    err.customErrorName === 'NotFound'
  ) {
    throw new InvalidRequestError('Space not found', 'SpaceNotFound')
  }
  throw err
}
