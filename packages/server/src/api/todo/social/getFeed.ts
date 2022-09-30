import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@adxp/xrpc-server'
import * as GetFeed from '../../../lexicon/types/todo/social/getFeed'
import { FollowIndex } from '../../../db/records/follow'
import { PostIndex } from '../../../db/records/post'
import { ProfileIndex } from '../../../db/records/profile'
import { User } from '../../../db/user'
import * as util from '../../../db/util'
import { LikeIndex } from '../../../db/records/like'
import { RepostIndex } from '../../../db/records/repost'
import { AdxRecord } from '../../../db/record'
import { getLocals } from '../../../util'

export default function (server: Server) {
  server.todo.social.getFeed(
    async (params: GetFeed.QueryParams, _input, req, res) => {
      const { author, limit, before } = params

      const { auth, db } = getLocals(res)
      const requester = auth.getUserDid(req)
      if (!requester) {
        throw new AuthRequiredError()
      }

      const builder = db.db.createQueryBuilder()

      if (author === undefined) {
        builder
          .from(User, 'user')
          .innerJoin(FollowIndex, 'follow', 'follow.creator = user.did')
          .leftJoin(RepostIndex, 'repost', 'repost.creator = follow.subject')
          .innerJoin(
            PostIndex,
            'post',
            'post.creator = follow.subject OR post.uri = repost.subject',
          )
          .leftJoin(User, 'author', 'author.did = post.creator')
          .where('user.did = :did', { did: requester })
          .andWhere('post.creator != :requester', { requester })
      } else {
        const authorWhere = author.startsWith('did:')
          ? 'originator.did'
          : 'originator.username'
        builder
          .from(PostIndex, 'post')
          .leftJoin(RepostIndex, 'repost', 'repost.subject = post.uri')
          .leftJoin(
            User,
            'originator',
            'originator.did = post.creator OR originator.did = repost.creator',
          )
          .leftJoin(User, 'author', 'author.did = post.creator')
          .where(`${authorWhere} = :author`, { author })
      }

      builder
        .select([
          'post.uri AS uri',
          'author.did AS authorDid',
          'author.username AS authorName',
          'author_profile.displayName AS authorDisplayName',
          'reposted_by.did AS repostedByDid',
          'reposted_by.username AS repostedByName',
          'reposted_by_profile.displayName AS repostedByDisplayName',
          author === undefined
            ? 'follow.subject == post.creator AS isNotRepost'
            : 'originator.did == post.creator as isNotRepost',
          'record.raw AS rawRecord',
          'like_count.count AS likeCount',
          'repost_count.count AS repostCount',
          'reply_count.count AS replyCount',
          'requester_repost.uri AS requesterRepost',
          'requester_like.uri AS requesterLike',
          'record.indexedAt AS indexedAt',
        ])
        .leftJoin(
          ProfileIndex,
          'author_profile',
          'author_profile.creator = author.did',
        )
        .leftJoin(User, 'reposted_by', 'reposted_by.did = repost.creator')
        .leftJoin(
          ProfileIndex,
          'reposted_by_profile',
          'reposted_by_profile.creator = reposted_by.did',
        )
        .leftJoin(AdxRecord, 'record', 'record.uri = post.uri')
        .leftJoin(
          util.countSubquery(LikeIndex, 'subject'),
          'like_count',
          'like_count.subject = post.uri',
        )
        .leftJoin(
          util.countSubquery(RepostIndex, 'subject'),
          'repost_count',
          'repost_count.subject = post.uri',
        )
        .leftJoin(
          util.countSubquery(PostIndex, 'replyParent'),
          'reply_count',
          'reply_count.subject = post.uri',
        )
        .leftJoin(
          RepostIndex,
          'requester_repost',
          `requester_repost.creator = :requester AND requester_repost.subject = post.uri`,
          { requester },
        )
        .leftJoin(
          LikeIndex,
          'requester_like',
          `requester_like.creator = :requester AND requester_like.subject = post.uri`,
          { requester },
        )
        .orderBy('post.indexedAt', 'DESC')
        .groupBy('post.uri')

      if (before !== undefined) {
        builder.andWhere('post.indexedAt < :before', { before })
      }
      if (limit !== undefined) {
        builder.limit(limit)
      }

      const queryRes = await builder.getRawMany()

      // @TODO add embeds
      const feed: GetFeed.FeedItem[] = queryRes.map((row) => ({
        cursor: row.indexedAt,
        uri: row.uri,
        author: {
          did: row.authorDid,
          name: row.authorName,
          displayName: row.authorDisplayName || undefined,
        },
        repostedBy:
          !row.isNotRepost && row.repostedByDid
            ? {
                did: row.repostedByDid,
                name: row.repostedByName,
                displayName: row.repostedByDisplayName || undefined,
              }
            : undefined,
        record: JSON.parse(row.rawRecord),
        replyCount: row.replyCount || 0,
        repostCount: row.repostCount || 0,
        likeCount: row.likeCount || 0,
        indexedAt: row.indexedAt,
        myState: {
          repost: row.requesterRepost || undefined,
          like: row.requesterLike || undefined,
        },
      }))

      return { encoding: 'application/json', body: { feed } }
    },
  )
}
