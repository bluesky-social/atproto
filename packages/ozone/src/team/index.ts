import Database from '../db'
import { Selectable } from 'kysely'
import { Member } from '../db/schema/member'
import { Member as TeamMember } from '../lexicon/types/tools/ozone/team/defs'
import { InvalidRequestError } from '@atproto/xrpc-server'

export type TeamServiceCreator = (db: Database) => TeamService

export class TeamService {
  constructor(public db: Database) {}

  static creator() {
    return (db: Database) => new TeamService(db)
  }

  async list({
    cursor,
    limit = 25,
  }: {
    cursor?: string
    limit?: number
  }): Promise<{ members: Selectable<Member>[]; cursor?: string }> {
    let builder = this.db.db.selectFrom('member').selectAll()
    if (cursor) {
      builder = builder.where('createdAt', '>', new Date(cursor))
    }
    const members = await builder
      .limit(limit)
      .orderBy('createdAt', 'asc')
      .execute()

    return { members, cursor: members.slice(-1)[0]?.createdAt.toISOString() }
  }

  async create({
    role,
    did,
    disabled,
    updatedAt,
    createdAt,
    lastUpdatedBy,
  }: Omit<Selectable<Member>, 'createdAt' | 'updatedAt'> & {
    createdAt?: Date
    updatedAt?: Date
  }): Promise<Selectable<Member>> {
    const now = new Date()
    const newModerator = await this.db.db
      .insertInto('member')
      .values({
        role,
        did,
        disabled,
        lastUpdatedBy,
        updatedAt: updatedAt || now,
        createdAt: createdAt || now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return newModerator
  }

  async upsert({
    role,
    did,
    lastUpdatedBy,
  }: Pick<
    Selectable<Member>,
    'role' | 'did' | 'lastUpdatedBy'
  >): Promise<void> {
    const now = new Date()
    await this.db.db
      .insertInto('member')
      .values({
        role,
        did,
        lastUpdatedBy,
        disabled: false,
        updatedAt: now,
        createdAt: now,
      })
      .onConflict((oc) => oc.column('did').doUpdateSet({ role }))
      .execute()
  }

  async update(
    did: string,
    updates: Partial<
      Pick<
        Selectable<Member>,
        'role' | 'disabled' | 'lastUpdatedBy' | 'updatedAt'
      >
    >,
  ): Promise<Selectable<Member>> {
    const updatedModerator = await this.db.db
      .updateTable('member')
      .where('did', '=', did)
      .set({
        ...updates,
        updatedAt: updates.updatedAt || new Date(),
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return updatedModerator
  }

  async delete(did: string): Promise<void> {
    await this.db.db.deleteFrom('member').where('did', '=', did).execute()
  }

  async assertCanDelete(did: string): Promise<void> {
    const memberExists = await this.doesMemberExist(did)

    if (!memberExists) {
      throw new InvalidRequestError('member not found', 'MemberNotFound')
    }
  }

  async doesMemberExist(did: string): Promise<boolean> {
    const member = await this.db.db
      .selectFrom('member')
      .select('did')
      .where('did', '=', did)
      .executeTakeFirst()

    return !!member
  }

  async getMember(did: string): Promise<Selectable<Member> | undefined> {
    const member = await this.db.db
      .selectFrom('member')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    return member
  }

  getMemberRole(member?: Selectable<Member>) {
    const isAdmin = member?.role === 'tools.ozone.team.defs#roleAdmin'
    const isModerator =
      isAdmin || member?.role === 'tools.ozone.team.defs#roleModerator'
    const isTriage =
      isModerator || member?.role === 'tools.ozone.team.defs#roleTriage'

    return {
      isModerator,
      isAdmin,
      isTriage,
    }
  }

  view(member: Selectable<Member>): TeamMember {
    return {
      did: member.did,
      role: member.role,
      disabled: member.disabled,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      lastUpdatedBy: member.lastUpdatedBy,
    }
  }
}
