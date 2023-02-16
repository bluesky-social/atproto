import { Kysely } from 'kysely'

export async function up(db: Kysely<unknown>): Promise<void> {
  // for, eg, "upvoteCount" on posts in feed views
  await db.schema
    .createIndex('vote_subject_direction_idx')
    .on('vote')
    .columns(['subject', 'direction'])
    .execute()

  // for, eg, "repostCount" on posts in feed views
  await db.schema
    .createIndex('repost_subject_idx')
    .on('repost')
    .column('subject')
    .execute()

  // for, eg, "replyCount" on posts in feed views
  await db.schema
    .createIndex('post_replyparent_idx')
    .on('post')
    .column('replyParent')
    .execute()

  // for, eg, "followersCount" on profile views
  await db.schema
    .createIndex('follow_subjectdid_idx')
    .on('follow')
    .column('subjectDid')
    .execute()

  // for, eg, "postsCount" on profile views
  await db.schema
    .createIndex('post_creator_idx')
    .on('post')
    .column('creator')
    .execute()

  // for, eg, profile views
  await db.schema
    .createIndex('profile_creator_idx')
    .on('profile')
    .column('creator')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropIndex('vote_subject_direction_idx').execute()
  await db.schema.dropIndex('repost_subject_idx').execute()
  await db.schema.dropIndex('post_replyparent_idx').execute()
  await db.schema.dropIndex('follow_subjectdid_idx').execute()
  await db.schema.dropIndex('post_creator_idx').execute()
  await db.schema.dropIndex('profile_creator_idx').execute()
}
