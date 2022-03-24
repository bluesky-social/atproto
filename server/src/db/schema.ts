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
  await userRoots(db)
  await userDids(db)
  await microblogPosts(db)
  await microblogLikes(db)
}

export const dropAll = async (db: KnexDB) => {
  await drop(db, 'microblog_likes')
  await drop(db, 'microblog_posts')
  await drop(db, 'repo_roots')
  await drop(db, 'user_dids')
}

export const drop = async (db: KnexDB, tableName: string) => {
  return db.schema.dropTableIfExists(tableName)
}
