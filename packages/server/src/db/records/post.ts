import { AdxUri } from '@adxp/common'
import * as microblog from '@adxp/microblog'
import { Post } from '@adxp/microblog'
import {
  DataSource,
  Entity,
  Column,
  PrimaryColumn,
  Repository,
  In,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm'
import { DbPlugin } from '../types'
import { UserDid } from '../user-dids'
import { collectionToTableName } from '../util'

const collection = 'bsky/posts'
const tableName = collectionToTableName(collection)

type Labeled<T> = T & {
  $type: string
  uri: string
}

@Entity({ name: tableName })
export class PostIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('varchar')
  @ManyToOne(() => UserDid, (user) => user.did)
  creator: string

  @Column('text')
  text: string

  @Column({ type: 'varchar', nullable: true })
  replyRoot?: string

  @Column({ type: 'varchar', nullable: true })
  replyParent?: string

  @Column('datetime')
  createdAt: string

  @UpdateDateColumn()
  indexedAt: Date
}

const getFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri): Promise<Labeled<Post.Record> | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    return found === null ? null : translateDbObj(found)
  }

const getManyFn =
  (repo: Repository<PostIndex>) =>
  async (uris: AdxUri[] | string[]): Promise<Labeled<Post.Record>[]> => {
    const uriStrs = uris.map((u) => u.toString())
    const found = await repo.findBy({ uri: In(uriStrs) })
    return found.map(translateDbObj)
  }

const setFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!microblog.isPost(obj)) {
      throw new Error('Not a valid post record')
    }
    const post = new PostIndex()
    post.uri = uri.toString()
    post.creator = uri.host
    post.text = obj.text
    post.createdAt = obj.createdAt
    post.replyRoot = obj.reply?.root
    post.replyParent = obj.reply?.parent

    await repo.save(post)
  }

const deleteFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

const translateDbObj = (dbObj: PostIndex): Labeled<Post.Record> => {
  const reply = dbObj.replyRoot
    ? {
        root: dbObj.replyRoot,
        parent: dbObj.replyParent,
      }
    : undefined
  return {
    $type: 'blueskyweb.xyz:Post',
    uri: dbObj.uri,
    text: dbObj.text,
    reply: reply,
    createdAt: dbObj.createdAt,
  }
}

export const makePlugin = (
  db: DataSource,
): DbPlugin<Post.Record, PostIndex> => {
  const repository = db.getRepository(PostIndex)
  return {
    collection,
    tableName,
    get: getFn(repository),
    getMany: getManyFn(repository),
    set: setFn(repository),
    delete: deleteFn(repository),
    translateDbObj,
  }
}

export default makePlugin
