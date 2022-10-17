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
import * as badgeAccept from './records/badgeAccept'
import * as badgeOffer from './records/badgeOffer'
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
  badge.PartialDB &
  badgeAccept.PartialDB &
  badgeOffer.PartialDB

export const createTables = async (
  db: Kysely<DatabaseSchema>,
  dialect: Dialect,
): Promise<void> => {
  if (dialect === 'pg') {
    try {
      // Add trigram support, supporting user search.
      // Explicitly add to public schema, so the extension can be seen in all schemas.
      await sql`create extension if not exists pg_trgm with schema public`.execute(
        db,
      )
    } catch (err: any) {
      // The "if not exists" isn't bulletproof against races, and we see test suites racing to
      // create the extension. So we can just ignore errors indicating the extension already exists.
      if (!err?.detail?.includes?.('(pg_trgm) already exists')) throw err
    }
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
    badgeAccept.createTable(db),
    badgeOffer.createTable(db),
  ])
}
