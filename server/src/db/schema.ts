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
    table.increments('id').primary()
    table.string('tid')
    table.string('author')
    table.string('program')
    table.string('text')
    table.string('time')
    table.string('cid')

    table.unique(['tid', 'author', 'program'])
    table.foreign('author').references('did').inTable('user_dids')
  })
}

const microblogLikes = async (db: KnexDB) => {
  return db.schema.createTable('microblog_interactions', (table) => {
    table.increments('id').primary()
    table.string('tid')
    table.string('author').references('user_dids.did')
    table.string('program')
    table.string('time')
    table.string('cid')
    table.integer('post')

    table.unique(['tid', 'author', 'program'])
    table.foreign('author').references('did').inTable('user_dids')
    table.foreign('post').references('id').inTable('microblog_posts')
  })
}

export const createTables = async (db: KnexDB) => {
  await Promise.all([
    userRoots(db),
    userDids(db),
    microblogPosts(db),
    microblogLikes(db),
  ])
}

export const dropAll = async (db: KnexDB) => {
  await Promise.all([
    drop(db, 'user_dids'),
    drop(db, 'repo_roots'),
    drop(db, 'microblog_posts'),
    drop(db, 'microblog_likes'),
  ])
}

export const drop = async (db: KnexDB, tableName: string) => {
  return db.schema.dropTableIfExists(tableName)
}
