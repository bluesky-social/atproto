import { Kysely, sql } from 'kysely'

import * as user from './tables/user'
import * as repoRoot from './tables/repo-root'
import * as record from './tables/record'
import * as invite from './tables/invite'
import * as notification from './tables/user-notification'

import * as post from './records/post'
import * as like from './records/like'
import * as repost from './records/repost'
import * as follow from './records/follow'
import * as profile from './records/profile'
import * as badge from './records/badge'
import { Dialect } from '.'

export type DatabaseSchema = user.PartialDB &
  repoRoot.PartialDB &
  record.PartialDB &
  invite.PartialDB &
  notification.PartialDB &
  post.PartialDB &
  like.PartialDB &
  repost.PartialDB &
  follow.PartialDB &
  profile.PartialDB &
  badge.PartialDB

export const createTables = async (
  db: Kysely<DatabaseSchema>,
  dialect: Dialect,
): Promise<void> => {
  if (dialect === 'pg') {
    // Add trigram support, supporting user search
    await sql`create extension if not exists pg_trgm`.execute(db)
  }
  await Promise.all([
    user.createTable(db, dialect),
    repoRoot.createTable(db),
    record.createTable(db),
    invite.createTable(db),
    notification.createTable(db),
    post.createTable(db),
    like.createTable(db),
    repost.createTable(db),
    follow.createTable(db),
    profile.createTable(db, dialect),
    badge.createTable(db),
  ])
}
