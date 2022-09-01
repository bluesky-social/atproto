import { LikedByView } from '@adxp/microblog'
import { DataSource } from 'typeorm'
import { LikeIndex } from '../records/like'
import { PostIndex } from '../records/post'

export const likedBy =
  (db: DataSource) =>
  async (params: LikedByView.Params): Promise<LikedByView.Response> => {
    const res = await db
      .createQueryBuilder()
      .select(['post.uri', 'like.uri'])
      .from(PostIndex, 'post')
      .addFrom(LikeIndex, 'like')
      .where('post.uri = :uri', { uri: params.uri })
      .where('like.subject = post.uri')
      .getRawMany()
    console.log('LIKED BY RES: ', res)
    return res as any
  }

export default likedBy
