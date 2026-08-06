import { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import { DidString, SpaceRefString } from '@atproto/syntax'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { ActorStore } from '../actor-store/actor-store.js'
import { SimplespaceConfig } from '../actor-store/db/index.js'
import { SpaceConfig } from '../actor-store/space/transactor.js'
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
    input: { policy: LexPolicy; appAccess: LexAppAccess },
  ): Promise<void> {
    const { spaceDid } = toSpaceRef(space)
    const config = {
      ...lexPolicyToDb(input.policy),
      ...lexAppAccessToDb(input.appAccess),
    }
    await this.actorStore.transact(spaceDid, async (actorTxn) => {
      const existing = await actorTxn.space.getSpaceConfig(space)
      if (existing) {
        throw new InvalidRequestError(
          'Space already exists',
          'SpaceAlreadyExists',
        )
      }
      await actorTxn.space.createSpace(space, config)
    })
  }

  async updateSpace(
    space: SpaceRefString,
    input: { policy?: LexPolicy; appAccess?: LexAppAccess },
  ): Promise<void> {
    const { spaceDid } = toSpaceRef(space)
    const config: Partial<SpaceConfig> = {
      ...(input.policy && lexPolicyToDb(input.policy)),
      ...(input.appAccess && lexAppAccessToDb(input.appAccess)),
    }
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
    config: SimplespaceConfig
    userDid: string
    clientId?: string
  }): Promise<void> {
    const { config, clientId } = opts

    if (config.appAccessType === 'allowList') {
      const allowed: string[] = JSON.parse(config.appAllowed)
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

  // Whether the space's policy admits this user. Everything but `managing-app` is
  // answerable from the authority's own state.
  async authorizeUser(opts: {
    config: SimplespaceConfig
    userDid: string
    clientId?: string
  }): Promise<boolean> {
    const { config, userDid } = opts
    const { spaceDid } = toSpaceRef(config.uri as SpaceRefString)

    // The authority is the only party who can reconfigure the space, so it must not be
    // able to lock itself out.
    if (userDid === spaceDid) return true

    switch (config.policy) {
      case 'public':
        return true
      case 'member-list':
        return this.actorStore.read(spaceDid, (store) =>
          store.space.isMember(config.uri, userDid),
        )
      case 'managing-app':
        return this.checkManagingApp({ ...opts, spaceDid })
      default:
        return false
    }
  }

  /**
   * Deletes the authority's own repo in the space along with it: no other party's data
   * is involved. A member's records stay where they are, as records nobody can obtain
   * a credential to read — their PDS is not notified, and the application is what
   * tells the user their space is gone.
   *
   * The space row stays as a tombstone so getSpaceCredential keeps answering
   * SpaceDeleted, which is how a syncer that missed the notification finds out.
   */
  async deleteSpace(space: SpaceRefString): Promise<void> {
    const { spaceDid } = toSpaceRef(space)

    const services = await this.actorStore.transact(
      spaceDid,
      async (actorTxn) => {
        const services = await actorTxn.space.getCredentialRecipients(space)
        await actorTxn.space.deleteSpace(space)
        return services
      },
    )

    const lxm = com.atproto.space.notifySpaceDeleted.$lxm
    this.backgroundQueue.add(async () => {
      for (const { serviceDid } of services) {
        // Best effort: a syncer that misses this learns the space is gone from
        // SpaceDeleted on its next credential renewal.
        try {
          const target = await resolveNotifyTarget(this, {
            iss: spaceDid,
            service: serviceDid,
            lxm,
          })
          if (!target) {
            spaceLogger.warn(
              { space, service: serviceDid, lxm },
              'could not resolve recipient',
            )
            continue
          }
          await xrpc(target.endpoint, com.atproto.space.notifySpaceDeleted, {
            headers: target.headers,
            body: { space },
          })
        } catch (err) {
          spaceLogger.warn(
            { err, space, service: serviceDid, lxm },
            'notify failed',
          )
        }
      }
    })
  }

  private async checkManagingApp(opts: {
    config: SimplespaceConfig
    spaceDid: DidString
    userDid: string
    clientId?: string
  }): Promise<boolean> {
    const { config, spaceDid, userDid, clientId } = opts
    const { managingApp } = config
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
          { space: config.uri, managingApp },
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
            space: config.uri as SpaceRefString,
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
        { err, space: config.uri, managingApp, user: userDid },
        'managing app check failed',
      )
      return false
    }
  }
}
