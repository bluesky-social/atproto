import { AdxUri } from '@adxp/common'
import * as microblog from '@adxp/microblog'
import { Post, postRecordValidator } from '@adxp/microblog'
import { DataSource, Entity, Column, PrimaryColumn, Repository } from 'typeorm'
import { DbPlugin } from '../types'
import { collectionToTableName } from '../util'

const collection = 'bsky/posts'
const tableName = collectionToTableName(collection)

@Entity({ name: tableName })
export class PostDbObj {
  @PrimaryColumn('string')
  uri: string

  @Column('text')
  text: string

  @Column('string')
  replyRoot?: string

  @Column('string')
  replyParent?: string

  @Column('datetime')
  createdAt: string
}

const getFn =
  (repo: Repository<PostDbObj>) =>
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
      text: found.uri,
      reply: reply,
      createdAt: found.createdAt,
    }
  }

const setFn =
  (repo: Repository<PostDbObj>) =>
  async (uri: AdxUri, obj: unknown): Promise<void> => {
    if (!microblog.isPost(obj)) {
      console.log(postRecordValidator)
      const res = postRecordValidator.validate(obj)
      console.log(res)
      throw new Error('Not a valid post record')
    }
    const post = new PostDbObj()
    post.uri = uri.toString()
    post.text = obj.text
    post.createdAt = obj.createdAt
    post.replyRoot = obj.reply?.root
    post.replyParent = obj.reply?.parent

    await repo.save(post)
  }

const deleteFn =
  (repo: Repository<PostDbObj>) =>
  async (uri: AdxUri): Promise<void> => {
    await repo.delete({ uri: uri.toString() })
  }

export const makePlugin = (db: DataSource): DbPlugin<Post.Record> => {
  const repository = db.getRepository(PostDbObj)
  return {
    collection,
    tableName,
    get: getFn(repository),
    set: setFn(repository),
    delete: deleteFn(repository),
  }
}

export default makePlugin
