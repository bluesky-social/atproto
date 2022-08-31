import { LikedByView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { LikeIndex } from '../records/like'
import { PostIndex } from '../records/post'

export const likedBy =
  (db: DataSource) =>
  async (params: LikedByView.Params): Promise<LikedByView.Response> => {
    const res = await db
      .createQueryBuilder()
      .select('post.uri', 'like.uri')
      .from(PostIndex, 'post')
      .addFrom(LikeIndex, 'like')
      .where('like.subject = post.uri')
    return res as any
  }

export default likedBy
