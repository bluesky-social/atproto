export default {
  $type: 'adxs-view',
  author: 'blueskyweb.xyz',
  name: 'FeedView',
  locale: {
    'en-US': {
      nameSingular: 'Feed',
      namePlural: 'Feeds',
    },
  },
  reads: ['blueskyweb.xyz:Feed', 'blueskyweb.xyz:SocialGraph'],
  parameters: {
    type: 'object',
    properties: {
      author: { type: 'string' },
      limit: { type: 'number' },
      lt: { type: 'string' },
    },
  },
  response: {
    type: 'object',
    required: ['feed'],
    properties: {
      feed: {
        type: 'array',
        items: { $ref: '#/$defs/feedItem' },
      },
    },
    $defs: {
      feedItem: {
        type: 'object',
        required: [
          'uri',
          'author',
          'zeet',
          'replyCount',
          'likeCount',
          'indexedAt',
        ],
        properties: {
          uri: { type: 'string', format: 'uri' },
          author: {
            type: 'object',
            required: ['username', 'displayName'],
            properties: {
              username: { type: 'string' },
              displayName: {
                type: 'string',
                minLength: 1,
                maxLength: 64,
              },
            },
          },
          zeet: {
            type: 'object',
            $comment: 'Expected to be a Zeet but may be other things',
          },
          replyCount: { type: 'number' },
          likeCount: { type: 'number' },
          indexedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
}
