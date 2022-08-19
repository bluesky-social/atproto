import { AdxUri } from '@adxp/common'
import * as microblog from '@adxp/microblog'
import { Post, postRecordValidator } from '@adxp/microblog'
import { DataSource, Entity, Column, PrimaryColumn, Repository } from 'typeorm'
import { DbPlugin } from '../types'
import { collectionToTableName } from '../util'

const collection = 'bsky/posts'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class PostIndex {
  @PrimaryColumn('varchar')
  uri: string

  @Column('text')
  text: string

  @Column({ type: 'varchar', nullable: true })
  replyRoot?: string

  @Column({ type: 'varchar', nullable: true })
  replyParent?: string

  @Column('datetime')
  createdAt: string
}

const getFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri): Promise<Post.Record | null> => {
    const found = await repo.findOneBy({ uri: uri.toString() })
    if (found === null) return null
    const reply = found.replyRoot
      ? {
          root: found.replyRoot,
          parent: found.replyParent,
        }
      : undefined
    return {
      text: found.text,
      reply: reply,
      createdAt: found.createdAt,
    }
  }

const setFn =
  (repo: Repository<PostIndex>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!microblog.isPost(obj)) {
      throw new Error('Not a valid post record')
    }
    const post = new PostIndex()
    post.uri = uri.toString()
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

export const makePlugin = (db: DataSource): DbPlugin<Post.Record> => {
  const repository = db.getRepository(PostIndex)
  return {
    collection,
    tableName,
    get: getFn(repository),
    set: setFn(repository),
    delete: deleteFn(repository),
  }
}

export default makePlugin
