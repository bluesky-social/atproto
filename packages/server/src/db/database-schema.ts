import { Kysely } from 'kysely'

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
): Promise<void> => {
  await Promise.all([
    user.createTable(db),
    repoRoot.createTable(db),
    record.createTable(db),
    invite.createTable(db),
    notification.createTable(db),
    post.createTable(db),
    like.createTable(db),
    repost.createTable(db),
    follow.createTable(db),
    profile.createTable(db),
    badge.createTable(db),
  ])
}
