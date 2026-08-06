import { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import { DidString, SpaceRefString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ActorStore } from '../actor-store/actor-store.js'
import { SimplespaceConfig } from '../actor-store/db/index.js'
import {
  resolveNotifyTarget,
  toSpaceRef,
} from '../api/com/atproto/space/util.js'
import { BackgroundQueue } from '../background.js'
import { com } from '../lexicons/index.js'
import { spaceLogger } from '../logger.js'
import { lexAppAccessToDb, lexPolicyToDb, toLexConfig } from './config.js'

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
    const policy = lexPolicyToDb(config.policy)
    const appAccess = lexAppAccessToDb(config.appAccess)

    await this.actorStore.transact(spaceDid, async (actorTxn) => {
      const existing = await actorTxn.space.getSpaceConfig(space)
      if (existing) {
        throw new InvalidRequestError(
          'Space already exists',
          'SpaceAlreadyExists',
        )
      }

      await actorTxn.space.createSpace(space, policy, appAccess)
    })
  }

  async updateSpace(
    space: SpaceRefString,
    patch: { policy?: LexPolicy; appAccess?: LexAppAccess },
  ): Promise<void> {
    const config = {
      ...(patch.policy && { policy: lexPolicyToDb(patch.policy) }),
      ...(patch.appAccess && { appAccess: lexAppAccessToDb(patch.appAccess) }),
    }
    const { spaceDid } = toSpaceRef(space)
    await this.actorStore.transact(spaceDid, async (actorTxn) => {
      await actorTxn.space.getActiveSpaceConfig(space)
      await actorTxn.space.updateSpaceConfig(space, config)
    })
  }

  async getSpace(space: SpaceRefString) {
    const { spaceDid } = toSpaceRef(space)
    const config = await this.actorStore.read(spaceDid, (store) =>
      store.space.getActiveSpaceConfig(space),
    )
    return toLexConfig(config)
  }

  /**
   * Both perimeters a credential has to clear. The app goes first because it decides
   * from the config alone, so a refused app is never disclosed to a third-party
   * managing app.
   */
  async authorizeCredential(opts: {
    space: SimplespaceConfig
    checked: boolean | 'ask-managing-app'
    userDid: string
    clientId?: string
  }): Promise<void> {
    const { space, clientId } = opts

    if (space.appAccessType === 'allowList') {
      const allowed: string[] = JSON.parse(space.appAllowed)
      if (!clientId || !allowed.includes(clientId)) {
        throw new InvalidRequestError(
          'Application not authorized for this space',
          'AppNotAuthorized',
        )
      }
    }

    if (!(await this.authorizeUser(opts))) {
      throw new InvalidRequestError(
        'User not authorized for this space',
        'UserNotAuthorized',
      )
    }
  }

  /**
   * The user perimeter. `checked` is the decision the store could reach on its own,
   * since the caller already holds it open; only a `managing-app` policy needs the call
   * out from here.
   */
  async authorizeUser(opts: {
    space: SimplespaceConfig
    checked: boolean | 'ask-managing-app'
    userDid: string
    clientId?: string
  }): Promise<boolean> {
    const { space, checked, userDid, clientId } = opts
    if (checked !== 'ask-managing-app') return checked
    const { spaceDid } = toSpaceRef(space.uri as SpaceRefString)
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
        await actorTxn.space.deleteSpace(space)
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
    space: SimplespaceConfig
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
            space: space.uri as SpaceRefString,
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
