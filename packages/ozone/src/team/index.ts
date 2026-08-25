import type { Selectable } from 'kysely'
import { chunkArray } from '@atproto/common'
import { type Client, type DidString, toDatetimeString } from '@atproto/lex'
import { InvalidRequestError } from '@atproto/xrpc-server'
import type { Database } from '../db/index.js'
import type { Member } from '../db/schema/member.js'
import { app, tools } from '../lexicons/index.js'
import { httpLogger } from '../logger.js'
import type { AuthHeaders } from '../mod-service/views.js'

export type TeamServiceCreator = (db: Database) => TeamService

export class TeamService {
  constructor(
    public db: Database,
    private appviewClient: Client,
    private appviewDid: string,
    private createAuthHeaders: (
      aud: string,
      method: string,
    ) => Promise<AuthHeaders>,
  ) {}

  static creator(
    appviewClient: Client,
    appviewDid: string,
    createAuthHeaders: (aud: string, method: string) => Promise<AuthHeaders>,
  ) {
    return (db: Database) =>
      new TeamService(db, appviewClient, appviewDid, createAuthHeaders)
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
          r === tools.ozone.team.defs.RoleAdmin ||
          r === tools.ozone.team.defs.RoleModerator ||
          r === tools.ozone.team.defs.RoleVerifier ||
          r === tools.ozone.team.defs.RoleTriage,
      )

      // Optimization: no need to query to know that no values will be returned
      if (!knownRoles.length) return { members: [] }

      builder = builder.where('role', 'in', knownRoles)
    }
    if (disabled !== undefined) {
      builder = builder.where('disabled', disabled ? 'is' : 'is not', true)
    }
    if (q) {
      builder = builder.where((eb) =>
        eb.or([
          eb('handle', 'ilike', `%${q}%`),
          eb('displayName', 'ilike', `%${q}%`),
        ]),
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
    did: DidString,
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

  async delete(did: DidString): Promise<void> {
    await this.db.db.deleteFrom('member').where('did', '=', did).execute()
  }

  async assertCanDelete(did: DidString): Promise<void> {
    const memberExists = await this.doesMemberExist(did)

    if (!memberExists) {
      throw new InvalidRequestError('member not found', 'MemberNotFound')
    }
  }

  async doesMemberExist(did: DidString): Promise<boolean> {
    const member = await this.db.db
      .selectFrom('member')
      .select('did')
      .where('did', '=', did)
      .executeTakeFirst()

    return !!member
  }

  async getMember(did: DidString): Promise<Selectable<Member> | undefined> {
    const member = await this.db.db
      .selectFrom('member')
      .selectAll()
      .where('did', '=', did)
      .executeTakeFirst()

    return member
  }

  getMemberRole(member?: Selectable<Member>) {
    const isAdmin = member?.role === tools.ozone.team.defs.RoleAdmin
    const isModerator =
      isAdmin || member?.role === tools.ozone.team.defs.RoleModerator
    const isTriage =
      isModerator || member?.role === tools.ozone.team.defs.RoleTriage
    const isVerifier =
      isAdmin || member?.role === tools.ozone.team.defs.RoleVerifier

    return {
      isModerator,
      isAdmin,
      isTriage,
      isVerifier,
    }
  }

  // getProfiles() only allows 25 DIDs at a time so we need to query in chunks
  async getProfiles(
    dids: DidString[],
  ): Promise<Map<string, app.bsky.actor.defs.ProfileViewDetailed>> {
    const profiles = new Map<string, app.bsky.actor.defs.ProfileViewDetailed>()

    try {
      const headers = await this.createAuthHeaders(
        this.appviewDid,
        app.bsky.actor.getProfiles.$lxm,
      )

      for (const actors of chunkArray(dids, 25)) {
        const body = await this.appviewClient.call(
          app.bsky.actor.getProfiles,
          { actors },
          headers,
        )

        body.profiles.forEach((profile) => {
          profiles.set(profile.did, profile)
        })
      }
    } catch (err) {
      httpLogger.error({ err, dids }, 'Failed to get profiles for team members')
    }

    return profiles
  }

  async syncMemberProfiles(): Promise<void> {
    let lastDid: DidString | undefined
    // Max 25 profiles can be fetched at a time so let's pull 25 members at a time from the db and update their profile details
    do {
      const members = await this.db.db
        .selectFrom('member')
        .select(['did'])
        .limit(25)
        .$if(!!lastDid, (q) => q.where('did', '>', lastDid!))
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

      lastDid = dids.at(-1)
    } while (lastDid)
  }

  async viewByDids(
    dids: DidString[],
  ): Promise<Map<string, tools.ozone.team.defs.Member>> {
    if (!dids.length) return new Map()
    const members = await this.db.db
      .selectFrom('member')
      .selectAll()
      .where('did', 'in', dids)
      .execute()
    const memberViews = await this.view(members)
    return new Map(memberViews.map((m) => [m.did, m]))
  }

  async view(
    members: Selectable<Member>[],
  ): Promise<tools.ozone.team.defs.Member[]> {
    const profiles = await this.getProfiles(members.map(({ did }) => did))
    return members.map((member) => {
      return {
        did: member.did,
        role: member.role,
        disabled: member.disabled,
        profile: profiles.get(member.did),
        createdAt: toDatetimeString(member.createdAt),
        updatedAt: toDatetimeString(member.updatedAt),
        lastUpdatedBy: member.lastUpdatedBy,
      }
    })
  }
}
