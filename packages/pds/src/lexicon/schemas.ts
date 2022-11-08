/**
* GENERATED CODE - DO NOT MODIFY
*/
import { MethodSchema, RecordSchema } from '@atproto/lexicon'

export const methodSchemaDict: Record<string, MethodSchema> = {
  'com.atproto.account.create': {
    lexicon: 1,
    id: 'com.atproto.account.create',
    type: 'procedure',
    description: 'Create an account.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['handle', 'email', 'password'],
        properties: {
          email: {
            type: 'string',
          },
          handle: {
            type: 'string',
          },
          inviteCode: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
          recoveryKey: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: [
          'accessJwt',
          'refreshJwt',
          'handle',
          'did',
          'declarationCid',
        ],
        properties: {
          accessJwt: {
            type: 'string',
          },
          refreshJwt: {
            type: 'string',
          },
          handle: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
          declarationCid: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    errors: [
      {
        name: 'InvalidHandle',
      },
      {
        name: 'InvalidPassword',
      },
      {
        name: 'InvalidInviteCode',
      },
      {
        name: 'HandleNotAvailable',
      },
    ],
  },
  'com.atproto.account.createInviteCode': {
    lexicon: 1,
    id: 'com.atproto.account.createInviteCode',
    type: 'procedure',
    description: 'Create an invite code.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['useCount'],
        properties: {
          useCount: {
            type: 'number',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['code'],
        properties: {
          code: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.account.delete': {
    lexicon: 1,
    id: 'com.atproto.account.delete',
    type: 'procedure',
    description: 'Delete an account.',
    input: {
      encoding: '',
      schema: {
        $defs: {},
      },
    },
    output: {
      encoding: '',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.account.get': {
    lexicon: 1,
    id: 'com.atproto.account.get',
    type: 'query',
    description: 'Get information about an account.',
    output: {
      encoding: '',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.account.requestPasswordReset': {
    lexicon: 1,
    id: 'com.atproto.account.requestPasswordReset',
    type: 'procedure',
    description: 'Initiate a user account password reset via email.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        properties: {},
        $defs: {},
      },
    },
  },
  'com.atproto.account.resetPassword': {
    lexicon: 1,
    id: 'com.atproto.account.resetPassword',
    type: 'procedure',
    description: 'Reset a user account password using a token.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['token', 'password'],
        properties: {
          token: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        properties: {},
        $defs: {},
      },
    },
    errors: [
      {
        name: 'ExpiredToken',
      },
      {
        name: 'InvalidToken',
      },
    ],
  },
  'com.atproto.repo.batchWrite': {
    lexicon: 1,
    id: 'com.atproto.repo.batchWrite',
    type: 'procedure',
    description: 'Apply a batch transaction of creates, puts, and deletes.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['did', 'writes'],
        properties: {
          did: {
            type: 'string',
            description: 'The DID of the repo.',
          },
          validate: {
            type: 'boolean',
            default: true,
            description: 'Validate the records?',
          },
          writes: {
            type: 'array',
            items: {
              oneOf: [
                {
                  type: 'object',
                  required: ['action', 'collection', 'value'],
                  properties: {
                    action: {
                      type: 'string',
                      const: 'create',
                    },
                    collection: {
                      type: 'string',
                    },
                    rkey: {
                      type: 'string',
                    },
                    value: {},
                  },
                },
                {
                  type: 'object',
                  required: ['action', 'collection', 'rkey', 'value'],
                  properties: {
                    action: {
                      type: 'string',
                      const: 'update',
                    },
                    collection: {
                      type: 'string',
                    },
                    rkey: {
                      type: 'string',
                    },
                    value: {},
                  },
                },
                {
                  type: 'object',
                  required: ['action', 'collection', 'rkey'],
                  properties: {
                    action: {
                      type: 'string',
                      const: 'delete',
                    },
                    collection: {
                      type: 'string',
                    },
                    rkey: {
                      type: 'string',
                    },
                  },
                },
              ],
            },
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.repo.createRecord': {
    lexicon: 1,
    id: 'com.atproto.repo.createRecord',
    type: 'procedure',
    description: 'Create a new record.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['did', 'collection', 'record'],
        properties: {
          did: {
            type: 'string',
            description: 'The DID of the repo.',
          },
          collection: {
            type: 'string',
            description: 'The NSID of the record collection.',
          },
          validate: {
            type: 'boolean',
            default: true,
            description: 'Validate the record?',
          },
          record: {
            type: 'object',
            description: 'The record to create.',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.repo.deleteRecord': {
    lexicon: 1,
    id: 'com.atproto.repo.deleteRecord',
    type: 'procedure',
    description: 'Delete a record.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['did', 'collection', 'rkey'],
        properties: {
          did: {
            type: 'string',
            description: 'The DID of the repo.',
          },
          collection: {
            type: 'string',
            description: 'The NSID of the record collection.',
          },
          rkey: {
            type: 'string',
            description: 'The key of the record.',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.repo.putRecord': {
    lexicon: 1,
    id: 'com.atproto.repo.putRecord',
    type: 'procedure',
    description: 'Write a record.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['did', 'collection', 'rkey', 'record'],
        properties: {
          did: {
            type: 'string',
            description: 'The DID of the repo.',
          },
          collection: {
            type: 'string',
            description: 'The NSID of the record type.',
          },
          rkey: {
            type: 'string',
            description: 'The TID of the record.',
          },
          validate: {
            type: 'boolean',
            default: true,
            description: 'Validate the record?',
          },
          record: {
            type: 'object',
            description: 'The record to create.',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.server.getAccountsConfig': {
    lexicon: 1,
    id: 'com.atproto.server.getAccountsConfig',
    type: 'query',
    description:
      "Get a document describing the service's accounts configuration.",
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['availableUserDomains'],
        properties: {
          inviteCodeRequired: {
            type: 'boolean',
          },
          availableUserDomains: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.session.create': {
    lexicon: 1,
    id: 'com.atproto.session.create',
    type: 'procedure',
    description: 'Create an authentication session.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['handle', 'password'],
        properties: {
          handle: {
            type: 'string',
          },
          password: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['accessJwt', 'refreshJwt', 'handle', 'did'],
        properties: {
          accessJwt: {
            type: 'string',
          },
          refreshJwt: {
            type: 'string',
          },
          handle: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.session.delete': {
    lexicon: 1,
    id: 'com.atproto.session.delete',
    type: 'procedure',
    description: 'Delete the current session.',
    output: {
      encoding: 'application/json',
      schema: {
        $defs: {},
      },
    },
  },
  'com.atproto.session.get': {
    lexicon: 1,
    id: 'com.atproto.session.get',
    type: 'query',
    description: 'Get information about the current session.',
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['handle', 'did'],
        properties: {
          handle: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  'com.atproto.session.refresh': {
    lexicon: 1,
    id: 'com.atproto.session.refresh',
    type: 'procedure',
    description: 'Refresh an authentication session.',
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['accessJwt', 'refreshJwt', 'handle', 'did'],
        properties: {
          accessJwt: {
            type: 'string',
          },
          refreshJwt: {
            type: 'string',
          },
          handle: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.actor.createScene': {
    lexicon: 1,
    id: 'app.bsky.actor.createScene',
    type: 'procedure',
    description: 'Create a scene.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['handle'],
        properties: {
          handle: {
            type: 'string',
          },
          recoveryKey: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['handle', 'did', 'declarationCid'],
        properties: {
          handle: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
          declarationCid: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    errors: [
      {
        name: 'InvalidHandle',
      },
      {
        name: 'HandleNotAvailable',
      },
    ],
  },
  'app.bsky.actor.updateProfile': {
    lexicon: 1,
    id: 'app.bsky.actor.updateProfile',
    type: 'procedure',
    description: 'Notify server that the user has seen notifications.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        properties: {
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          description: {
            type: 'string',
            maxLength: 256,
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri', 'cid', 'record'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          record: {
            type: 'object',
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.feed.setVote': {
    lexicon: 1,
    id: 'app.bsky.feed.setVote',
    type: 'procedure',
    description: "Upvote, downvote, or clear the user's vote for a post.",
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['subject', 'direction'],
        properties: {
          subject: {
            $ref: '#/$defs/subject',
          },
          direction: {
            type: 'string',
            enum: ['up', 'down', 'none'],
          },
        },
        $defs: {
          subject: {
            type: 'object',
            required: ['uri', 'cid'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
            },
          },
        },
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        properties: {
          upvote: {
            type: 'string',
          },
          downvote: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    defs: {
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  'app.bsky.notification.getCount': {
    lexicon: 1,
    id: 'app.bsky.notification.getCount',
    type: 'query',
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['count'],
        properties: {
          count: {
            type: 'number',
          },
        },
        $defs: {},
      },
    },
  },
  'app.bsky.notification.updateSeen': {
    lexicon: 1,
    id: 'app.bsky.notification.updateSeen',
    type: 'procedure',
    description: 'Notify server that the user has seen notifications.',
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['seenAt'],
        properties: {
          seenAt: {
            type: 'string',
            format: 'date-time',
          },
        },
        $defs: {},
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        $defs: {},
      },
    },
  },
}
export const methodSchemas: MethodSchema[] = Object.values(methodSchemaDict)
export const ids = {
  AppBskyActorProfile: 'app.bsky.actor.profile',
  AppBskyFeedMediaEmbed: 'app.bsky.feed.mediaEmbed',
  AppBskyFeedPost: 'app.bsky.feed.post',
  AppBskyFeedRepost: 'app.bsky.feed.repost',
  AppBskyFeedTrend: 'app.bsky.feed.trend',
  AppBskyFeedTrending: 'app.bsky.feed.trending',
  AppBskyFeedVote: 'app.bsky.feed.vote',
  AppBskyGraphAssertion: 'app.bsky.graph.assertion',
  AppBskyGraphConfirmation: 'app.bsky.graph.confirmation',
  AppBskyGraphFollow: 'app.bsky.graph.follow',
  AppBskySystemDeclaration: 'app.bsky.system.declaration',
}
export const recordSchemaDict: Record<string, RecordSchema> = {
  'app.bsky.actor.profile': {
    lexicon: 1,
    id: 'app.bsky.actor.profile',
    type: 'record',
    key: 'literal:self',
    record: {
      type: 'object',
      required: ['displayName'],
      properties: {
        displayName: {
          type: 'string',
          maxLength: 64,
        },
        description: {
          type: 'string',
          maxLength: 256,
        },
      },
      $defs: {},
    },
  },
  'app.bsky.feed.mediaEmbed': {
    lexicon: 1,
    id: 'app.bsky.feed.mediaEmbed',
    type: 'record',
    description: 'A list of media embedded in a post or document.',
    key: 'tid',
    record: {
      type: 'object',
      required: ['media'],
      properties: {
        media: {
          type: 'array',
          items: {
            $ref: '#/$defs/mediaEmbed',
          },
        },
      },
      $defs: {
        mediaEmbed: {
          type: 'object',
          required: ['original'],
          properties: {
            alt: {
              type: 'string',
            },
            thumb: {
              $ref: '#/$defs/mediaEmbedBlob',
            },
            original: {
              $ref: '#/$defs/mediaEmbedBlob',
            },
          },
        },
        mediaEmbedBlob: {
          type: 'object',
          required: ['mimeType', 'blobId'],
          properties: {
            mimeType: {
              type: 'string',
            },
            blobId: {
              type: 'string',
            },
          },
        },
      },
    },
    defs: {
      mediaEmbed: {
        type: 'object',
        required: ['original'],
        properties: {
          alt: {
            type: 'string',
          },
          thumb: {
            $ref: '#/$defs/mediaEmbedBlob',
          },
          original: {
            $ref: '#/$defs/mediaEmbedBlob',
          },
        },
      },
      mediaEmbedBlob: {
        type: 'object',
        required: ['mimeType', 'blobId'],
        properties: {
          mimeType: {
            type: 'string',
          },
          blobId: {
            type: 'string',
          },
        },
      },
    },
  },
  'app.bsky.feed.post': {
    lexicon: 1,
    id: 'app.bsky.feed.post',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['text', 'createdAt'],
      properties: {
        text: {
          type: 'string',
          maxLength: 256,
        },
        entities: {
          type: 'array',
          items: {
            $ref: '#/$defs/entity',
          },
        },
        reply: {
          type: 'object',
          required: ['root', 'parent'],
          properties: {
            root: {
              $ref: '#/$defs/postRef',
            },
            parent: {
              $ref: '#/$defs/postRef',
            },
          },
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        entity: {
          type: 'object',
          required: ['index', 'type', 'value'],
          properties: {
            index: {
              $ref: '#/$defs/textSlice',
            },
            type: {
              type: 'string',
              $comment: "Expected values are 'mention', 'hashtag', and 'link'.",
            },
            value: {
              type: 'string',
            },
          },
        },
        textSlice: {
          type: 'object',
          required: ['start', 'end'],
          properties: {
            start: {
              type: 'number',
              minimum: 0,
            },
            end: {
              type: 'number',
              minimum: 0,
            },
          },
        },
        postRef: {
          type: 'object',
          required: ['uri', 'cid'],
          properties: {
            uri: {
              type: 'string',
            },
            cid: {
              type: 'string',
            },
          },
        },
      },
    },
    defs: {
      postRef: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
      entity: {
        type: 'object',
        required: ['index', 'type', 'value'],
        properties: {
          index: {
            $ref: '#/$defs/textSlice',
          },
          type: {
            type: 'string',
            $comment: "Expected values are 'mention', 'hashtag', and 'link'.",
          },
          value: {
            type: 'string',
          },
        },
      },
      textSlice: {
        type: 'object',
        required: ['start', 'end'],
        properties: {
          start: {
            type: 'number',
            minimum: 0,
          },
          end: {
            type: 'number',
            minimum: 0,
          },
        },
      },
    },
  },
  'app.bsky.feed.repost': {
    lexicon: 1,
    id: 'app.bsky.feed.repost',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/subject',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        subject: {
          type: 'object',
          required: ['uri', 'cid'],
          properties: {
            uri: {
              type: 'string',
            },
            cid: {
              type: 'string',
            },
          },
        },
      },
    },
    defs: {
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  'app.bsky.feed.trend': {
    lexicon: 1,
    id: 'app.bsky.feed.trend',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/subject',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        subject: {
          type: 'object',
          required: ['uri', 'cid'],
          properties: {
            uri: {
              type: 'string',
            },
            cid: {
              type: 'string',
            },
          },
        },
      },
    },
    defs: {
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  'app.bsky.feed.trending': {
    lexicon: 1,
    id: 'app.bsky.feed.trending',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/subject',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        subject: {
          type: 'object',
          required: ['uri', 'cid'],
          properties: {
            uri: {
              type: 'string',
            },
            cid: {
              type: 'string',
            },
          },
        },
      },
    },
    defs: {
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  'app.bsky.feed.vote': {
    lexicon: 1,
    id: 'app.bsky.feed.vote',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'direction', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/subject',
        },
        direction: {
          type: 'string',
          enum: ['up', 'down'],
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        subject: {
          type: 'object',
          required: ['uri', 'cid'],
          properties: {
            uri: {
              type: 'string',
            },
            cid: {
              type: 'string',
            },
          },
        },
      },
    },
    defs: {
      subject: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
        },
      },
    },
  },
  'app.bsky.graph.assertion': {
    lexicon: 1,
    id: 'app.bsky.graph.assertion',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['assertion', 'subject', 'createdAt'],
      properties: {
        assertion: {
          type: 'string',
        },
        subject: {
          type: 'object',
          required: ['did', 'declarationCid'],
          properties: {
            did: {
              type: 'string',
            },
            declarationCid: {
              type: 'string',
            },
          },
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {},
    },
  },
  'app.bsky.graph.confirmation': {
    lexicon: 1,
    id: 'app.bsky.graph.confirmation',
    type: 'record',
    key: 'tid',
    record: {
      type: 'object',
      required: ['originator', 'assertion', 'createdAt'],
      properties: {
        originator: {
          type: 'object',
          required: ['did', 'declarationCid'],
          properties: {
            did: {
              type: 'string',
            },
            declarationCid: {
              type: 'string',
            },
          },
        },
        assertion: {
          type: 'object',
          required: ['uri', 'cid'],
          properties: {
            uri: {
              type: 'string',
            },
            cid: {
              type: 'string',
            },
          },
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {},
    },
  },
  'app.bsky.graph.follow': {
    lexicon: 1,
    id: 'app.bsky.graph.follow',
    type: 'record',
    description: 'A social follow.',
    key: 'tid',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          type: 'object',
          required: ['did', 'declarationCid'],
          properties: {
            did: {
              type: 'string',
            },
            declarationCid: {
              type: 'string',
            },
          },
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {},
    },
  },
  'app.bsky.system.declaration': {
    lexicon: 1,
    id: 'app.bsky.system.declaration',
    description:
      'Context for an account that is considered intrinsic to it and alters the fundamental understanding of an account of changed. A declaration should be treated as immutable.',
    type: 'record',
    key: 'literal:self',
    record: {
      type: 'object',
      required: ['actorType'],
      properties: {
        actorType: {
          oneOf: [
            {
              $ref: '#/$defs/actorKnown',
            },
            {
              $ref: '#/$defs/actorUnknown',
            },
          ],
        },
      },
      $defs: {
        actorKnown: {
          type: 'string',
          enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
        },
        actorUnknown: {
          type: 'string',
          not: {
            enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
          },
        },
      },
    },
    defs: {
      actorKnown: {
        type: 'string',
        enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
      },
      actorUnknown: {
        type: 'string',
        not: {
          enum: ['app.bsky.system.actorUser', 'app.bsky.system.actorScene'],
        },
      },
    },
  },
}
export const recordSchemas: RecordSchema[] = Object.values(recordSchemaDict)
