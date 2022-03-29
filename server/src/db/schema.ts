import { KnexDB } from './types'

const userRoots = async (db: KnexDB) => {
  return db.schema.createTable('repo_roots', (table) => {
    table.string('did').primary()
    table.string('root')
  })
}

const userDids = async (db: KnexDB) => {
  return db.schema.createTable('user_dids', (table) => {
    table.string('did').primary()
    table.string('username').unique()
  })
}

const microblogPosts = async (db: KnexDB) => {
  return db.schema.createTable('microblog_posts', (table) => {
    table.unique(['tid', 'author', 'program'])
    table.string('tid')
    table.string('author')
    table.string('program')
    table.string('text')
    table.string('time')
    table.string('cid')

    table.foreign('author').references('did').inTable('user_dids')
  })
}

const microblogLikes = async (db: KnexDB) => {
  return db.schema.createTable('microblog_interactions', (table) => {
    table.primary(['tid', 'author', 'program'])
    table.string('tid')
    table.string('author').references('user_dids.did')
    table.string('program')
    table.string('time')
    table.string('cid')

    table.string('post_tid')
    table.string('post_author')
    table.string('post_program')
    table.string('post_cid')

    table.foreign('author').references('did').inTable('user_dids')
    table.foreign('post_tid').references('tid').inTable('microblog_posts')
    table.foreign('post_author').references('author').inTable('microblog_posts')
    table
      .foreign('post_program')
      .references('program')
      .inTable('microblog_posts')
  })
}

const follows = async (db: KnexDB) => {
  return db.schema.createTable('follows', (table) => {
    table.primary(['creator', 'target'])
    table.string('creator')
    table.string('target')

    table.foreign('creator').references('did').inTable('user_dids')
    table.foreign('target').references('did').inTable('user_dids')
  })
}

export const createTables = async (db: KnexDB) => {
  await userRoots(db)
  await userDids(db)
  await microblogPosts(db)
  await microblogLikes(db)
  await follows(db)
}

export const dropAll = async (db: KnexDB) => {
  await drop(db, 'follows')
  await drop(db, 'microblog_likes')
  await drop(db, 'microblog_posts')
  await drop(db, 'repo_roots')
  await drop(db, 'user_dids')
}

export const drop = async (db: KnexDB, tableName: string) => {
  return db.schema.dropTableIfExists(tableName)
}
