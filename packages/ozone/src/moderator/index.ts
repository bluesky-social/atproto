import Database from '../db'
import { Selectable } from 'kysely'
import { Moderator } from '../db/schema/moderator'
import { User } from '../lexicon/types/tools/ozone/moderator/defs'
import { InvalidRequestError } from '@atproto/xrpc-server'

export type ModeratorServiceCreator = (db: Database) => ModeratorService

export class ModeratorService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new ModeratorService(db)
  }

  //   TODO: Implement cursor-based pagination here
  async list(): Promise<Selectable<Moderator>[]> {
    const list = await this.db.db.selectFrom('moderator').selectAll().execute()

    return list
  }

  async create({
    role,
    did,
    disabled,
    updatedAt,
    createdAt,
    lastUpdatedBy,
  }: Omit<Selectable<Moderator>, 'id' | 'createdAt' | 'updatedAt'> & {
    createdAt?: Date
    updatedAt?: Date
  }): Promise<Selectable<Moderator>> {
    const newTemplate = await this.db.db
      .insertInto('moderator')
      .values({
        role,
        did,
        disabled,
        lastUpdatedBy,
        updatedAt: updatedAt || new Date(),
        createdAt: createdAt || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return newTemplate
  }

  async update(
    did: string,
    updates: Partial<
      Pick<
        Selectable<Moderator>,
        'role' | 'disabled' | 'lastUpdatedBy' | 'updatedAt'
      >
    >,
  ): Promise<Selectable<Moderator>> {
    const updatedTemplate = await this.db.db
      .updateTable('moderator')
      .where('did', '=', did)
      .set({
        ...updates,
        updatedAt: updates.updatedAt || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return updatedTemplate
  }

  async delete(did: string): Promise<void> {
    await this.db.db.deleteFrom('moderator').where('did', '=', did).execute()
  }

  async canDelete(did: string): Promise<boolean> {
    const otherAdminsExist = await this.areThereOtherAdmins(did)

    if (!otherAdminsExist) {
      throw new InvalidRequestError('last admin', 'LastAdmin')
    }

    const userExists = await this.doesUserExist(did)

    if (!userExists) {
      throw new InvalidRequestError('moderator not found', 'ModeratorNotFound')
    }

    return true
  }

  async areThereOtherAdmins(did: string): Promise<boolean> {
    const otherAdmins = await this.db.db
      .selectFrom('moderator')
      .select((qb) => qb.fn.count<number>('id').as('count'))
      .where('did', '!=', did)
      .where('role', '=', 'tools.ozone.moderator.defs#modRoleAdmin')
      .executeTakeFirst()

    return !!otherAdmins?.count
  }

  async doesUserExist(did: string): Promise<boolean> {
    const user = await this.db.db
      .selectFrom('moderator')
      .select('did')
      .where('did', '=', did)
      .executeTakeFirst()

    return !!user
  }

  async getUser(did: string): Promise<User | undefined> {
    const user = await this.db.db
      .selectFrom('moderator')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    return user
  }

  getUserRole(user?: User) {
    const isAdmin = user?.role === 'tools.ozone.moderator.defs#modRoleAdmin'
    const isModerator =
      isAdmin || user?.role === 'tools.ozone.moderator.defs#modRoleModerator'
    const isTriage =
      isModerator || user?.role === 'tools.ozone.moderator.defs#modRoleTriage'

    return {
      isModerator,
      isAdmin,
      isTriage,
    }
  }

  view(moderator: Selectable<Moderator>): User {
    return {
      id: `${moderator.id}`,
      did: moderator.did,
      role: moderator.role,
      disabled: moderator.disabled,
      createdAt: moderator.createdAt.toISOString(),
      updatedAt: moderator.updatedAt.toISOString(),
      lastUpdatedBy: moderator.lastUpdatedBy,
    }
  }
}
