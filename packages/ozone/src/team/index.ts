import { Selectable } from 'kysely'
import AtpAgent from '@atproto/api'
import { chunkArray } from '@atproto/common'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Database } from '../db'
import { Member } from '../db/schema/member'
import { ids } from '../lexicon/lexicons'
import { ProfileViewDetailed } from '../lexicon/types/app/bsky/actor/defs'
import { Member as TeamMember } from '../lexicon/types/tools/ozone/team/defs'
import { httpLogger } from '../logger'
import { AuthHeaders } from '../mod-service/views'

export type TeamServiceCreator = (db: Database) => TeamService

export class TeamService {
  constructor(
    public db: Database,
    private appviewAgent: AtpAgent,
    private appviewDid: string,
    private createAuthHeaders: (
      aud: string,
      method: string,
    ) => Promise<AuthHeaders>,
  ) {}

  static creator(
    appviewAgent: AtpAgent,
    appviewDid: string,
    createAuthHeaders: (aud: string, method: string) => Promise<AuthHeaders>,
  ) {
    return (db: Database) =>
      new TeamService(db, appviewAgent, appviewDid, createAuthHeaders)
  }

  async list({
    cursor,
    limit = 25,
    roles,
    disabled,
    q,
  }: {
    q?: string
    cursor?: string
    limit?: number
    disabled?: boolean
    roles?: string[]
  }): Promise<{ members: Selectable<Member>[]; cursor?: string }> {
    let builder = this.db.db.selectFrom('member').selectAll()
    if (cursor) {
      builder = builder.where('createdAt', '>', new Date(cursor))
    }
    if (roles !== undefined) {
      const knownRoles = roles.filter(
        (r) =>
          r === 'tools.ozone.team.defs#roleAdmin' ||
          r === 'tools.ozone.team.defs#roleModerator' ||
          r === 'tools.ozone.team.defs#roleVerifier' ||
          r === 'tools.ozone.team.defs#roleTriage',
      )

      // Optimization: no need to query to know that no values will be returned
      if (!knownRoles.length) return { members: [] }

      builder = builder.where('role', 'in', knownRoles)
    }
    if (disabled !== undefined) {
      builder = builder.where('disabled', disabled ? 'is' : 'is not', true)
    }
    if (q) {
      builder = builder.where((qb) =>
        qb
          .orWhere('handle', 'ilike', `%${q}%`)
          .orWhere('displayName', 'ilike', `%${q}%`),
      )
    }

    const members = await builder
      .limit(limit)
      .orderBy('createdAt', 'asc')
      .orderBy('handle', 'asc')
      .execute()

    return { members, cursor: members.at(-1)?.createdAt.toISOString() }
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
    const newMember = await this.db.db
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

    return newMember
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
      .onConflict((oc) =>
        oc.column('did').doUpdateSet({ role, updatedAt: now, lastUpdatedBy }),
      )
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
    const { role, disabled, lastUpdatedBy, updatedAt = new Date() } = updates
    const updatedMember = await this.db.db
      .updateTable('member')
      .where('did', '=', did)
      .set({
        role,
        disabled,
        lastUpdatedBy,
        updatedAt,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    return updatedMember
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
    const isVerifier =
      isAdmin || member?.role === 'tools.ozone.team.defs#roleVerifier'

    return {
      isModerator,
      isAdmin,
      isTriage,
      isVerifier,
    }
  }

  // getProfiles() only allows 25 DIDs at a time so we need to query in chunks
  async getProfiles(dids: string[]): Promise<Map<string, ProfileViewDetailed>> {
    const profiles = new Map<string, ProfileViewDetailed>()

    try {
      const headers = await this.createAuthHeaders(
        this.appviewDid,
        ids.AppBskyActorGetProfiles,
      )

      for (const actors of chunkArray(dids, 25)) {
        const { data } = await this.appviewAgent.getProfiles(
          { actors },
          headers,
        )

        data.profiles.forEach((profile) => {
          profiles.set(profile.did, profile)
        })
      }
    } catch (err) {
      httpLogger.error({ err, dids }, 'Failed to get profiles for team members')
    }

    return profiles
  }

  async syncMemberProfiles(): Promise<void> {
    let lastDid = ''
    // Max 25 profiles can be fetched at a time so let's pull 25 members at a time from the db and update their profile details
    do {
      const members = await this.db.db
        .selectFrom('member')
        .select(['did'])
        .limit(25)
        .if(!!lastDid, (q) => q.where('did', '>', lastDid))
        .orderBy('did', 'asc')
        .execute()

      const dids = members.map((member) => member.did)
      const profiles = await this.getProfiles(dids)

      for (const profile of profiles.values()) {
        await this.db.db
          .updateTable('member')
          .where('did', '=', profile.did)
          .set({
            handle: profile.handle,
            displayName: profile.displayName || null,
          })
          .execute()
      }

      lastDid = dids.at(-1) || ''
    } while (lastDid)
  }

  async view(members: Selectable<Member>[]): Promise<TeamMember[]> {
    const profiles = await this.getProfiles(members.map(({ did }) => did))
    return members.map((member) => {
      return {
        did: member.did,
        role: member.role,
        disabled: member.disabled,
        profile: profiles.get(member.did),
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        lastUpdatedBy: member.lastUpdatedBy,
      }
    })
  }
}
