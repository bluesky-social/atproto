import { Knex } from 'knex'
import { KnexDB } from './types'

type Table = Knex.CreateTableBuilder

type Schema = {
  name: string
  create: (db: Knex.CreateTableBuilder) => void
}

const userRoots = {
  name: 'repo_roots',
  create: (table: Table) => {
    table.string('did').primary()
    table.string('root')
  },
}

const userDids = {
  name: 'user_dids',
  create: (table: Table) => {
    table.string('did').primary()
    table.string('username').unique()
  },
}

const posts = {
  name: 'posts',
  create: (table: Table) => {
    table.unique(['tid', 'author', 'program'])
    table.string('tid')
    table.string('author')
    table.string('program')
    table.string('text')
    table.string('time')
    table.string('cid')

    table.foreign('author').references('did').inTable('user_dids')
  },
}

const likes = {
  name: 'likes',
  create: (table: Table) => {
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
    table.foreign('post_tid').references('tid').inTable('posts')
    table.foreign('post_author').references('author').inTable('posts')
    table.foreign('post_program').references('program').inTable('posts')
  },
}

const follows = {
  name: 'follows',
  create: (table: Table) => {
    table.primary(['creator', 'target'])
    table.string('creator')
    table.string('target')

    table.foreign('creator').references('did').inTable('user_dids')
    table.foreign('target').references('did').inTable('user_dids')
  },
}

const SCHEMAS: Schema[] = [userRoots, userDids, posts, likes, follows]

export const exists = async (db: KnexDB, name: string) => {
  return db.schema.hasTable(name)
}

export const create = async (db: KnexDB, schema: Schema) => {
  if (await exists(db, schema.name)) return
  await db.schema.createTable(schema.name, schema.create)
}

export const drop = async (db: KnexDB, name: string) => {
  return db.schema.dropTableIfExists(name)
}

export const createTables = async (db: KnexDB) => {
  await Promise.all(SCHEMAS.map((s) => create(db, s)))
}

export const dropAll = async (db: KnexDB) => {
  await Promise.all(SCHEMAS.map((s) => drop(db, s.name)))
}
