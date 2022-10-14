/**
* GENERATED CODE - DO NOT MODIFY
*/
import { MethodSchema, RecordSchema } from '@adxp/lexicon'

export const methodSchemas: MethodSchema[] = [
  {
    lexicon: 1,
    id: 'com.atproto.createAccount',
    type: 'procedure',
    description: 'Create an account.',
    parameters: {},
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          email: {
            type: 'string',
          },
          username: {
            type: 'string',
          },
          inviteCode: {
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
        required: ['jwt', 'username', 'did'],
        properties: {
          jwt: {
            type: 'string',
          },
          username: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
    errors: [
      {
        name: 'InvalidUsername',
      },
      {
        name: 'InvalidPassword',
      },
      {
        name: 'InvalidInviteCode',
      },
      {
        name: 'UsernameNotAvailable',
      },
    ],
  },
  {
    lexicon: 1,
    id: 'com.atproto.createInviteCode',
    type: 'procedure',
    description: 'Create an invite code.',
    parameters: {},
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
  {
    lexicon: 1,
    id: 'com.atproto.createSession',
    type: 'procedure',
    description: 'Create an authentication session.',
    parameters: {},
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: {
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
        required: ['jwt', 'name', 'did'],
        properties: {
          jwt: {
            type: 'string',
          },
          name: {
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
  {
    lexicon: 1,
    id: 'com.atproto.deleteAccount',
    type: 'procedure',
    description: 'Delete an account.',
    parameters: {},
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
  {
    lexicon: 1,
    id: 'com.atproto.deleteSession',
    type: 'procedure',
    description: 'Delete the current session.',
    parameters: {},
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
  {
    lexicon: 1,
    id: 'com.atproto.getAccount',
    type: 'query',
    description: 'Get information about an account.',
    parameters: {},
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
  {
    lexicon: 1,
    id: 'com.atproto.getAccountsConfig',
    type: 'query',
    description:
      "Get a document describing the service's accounts configuration.",
    parameters: {},
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
  {
    lexicon: 1,
    id: 'com.atproto.getSession',
    type: 'query',
    description: 'Get information about the current session.',
    parameters: {},
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['name', 'did'],
        properties: {
          name: {
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
  {
    lexicon: 1,
    id: 'com.atproto.repoBatchWrite',
    type: 'procedure',
    description: 'Apply a batch transaction of creates, puts, and deletes.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      validate: {
        type: 'boolean',
        default: true,
        description: 'Validate the records?',
      },
    },
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['writes'],
        properties: {
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
                    value: {},
                  },
                },
                {
                  type: 'object',
                  required: ['action', 'collection', 'tid', 'value'],
                  properties: {
                    action: {
                      type: 'string',
                      const: 'update',
                    },
                    collection: {
                      type: 'string',
                    },
                    tid: {
                      type: 'string',
                    },
                    value: {},
                  },
                },
                {
                  type: 'object',
                  required: ['action', 'collection', 'tid'],
                  properties: {
                    action: {
                      type: 'string',
                      const: 'delete',
                    },
                    collection: {
                      type: 'string',
                    },
                    tid: {
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
  {
    lexicon: 1,
    id: 'com.atproto.repoCreateRecord',
    type: 'procedure',
    description: 'Create a new record.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record collection.',
      },
      validate: {
        type: 'boolean',
        default: true,
        description: 'Validate the record?',
      },
    },
    input: {
      encoding: 'application/json',
      description: 'The record to create',
      schema: {
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
  {
    lexicon: 1,
    id: 'com.atproto.repoDeleteRecord',
    type: 'procedure',
    description: 'Delete a record.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record collection.',
      },
      rkey: {
        type: 'string',
        required: true,
        description: 'The key of the record.',
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repoDescribe',
    type: 'query',
    description:
      'Get information about the repo, including the list of collections.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The username or DID of the repo.',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['name', 'did', 'didDoc', 'collections', 'nameIsCorrect'],
        properties: {
          name: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
          didDoc: {
            type: 'object',
          },
          collections: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          nameIsCorrect: {
            type: 'boolean',
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repoGetRecord',
    type: 'query',
    description: 'Fetch a record.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The username or DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the collection.',
      },
      rkey: {
        type: 'string',
        required: true,
        description: 'The key of the record.',
      },
      cid: {
        type: 'string',
        required: false,
        description:
          'The CID of the version of the record. If not specified, then return the most recent version.',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri', 'value'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          value: {
            type: 'object',
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repoListRecords',
    type: 'query',
    description: 'List a range of records in a collection.',
    parameters: {
      user: {
        type: 'string',
        required: true,
        description: 'The username or DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record type.',
      },
      limit: {
        type: 'number',
        minimum: 1,
        default: 50,
        description: 'The number of records to return. TODO-max number?',
      },
      before: {
        type: 'string',
        description: 'A TID to filter the range of records returned.',
      },
      after: {
        type: 'string',
        description: 'A TID to filter the range of records returned.',
      },
      reverse: {
        type: 'boolean',
        description: 'Reverse the order of the returned records?',
        default: false,
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['records'],
        properties: {
          records: {
            type: 'array',
            items: {
              type: 'object',
              required: ['uri', 'cid', 'value'],
              properties: {
                uri: {
                  type: 'string',
                },
                cid: {
                  type: 'string',
                },
                value: {
                  type: 'object',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.repoPutRecord',
    type: 'procedure',
    description: 'Write a record.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      collection: {
        type: 'string',
        required: true,
        description: 'The NSID of the record type.',
      },
      rkey: {
        type: 'string',
        required: true,
        description: 'The TID of the record.',
      },
      validate: {
        type: 'boolean',
        default: true,
        description: 'Validate the record?',
      },
    },
    input: {
      encoding: 'application/json',
      schema: {
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
  {
    lexicon: 1,
    id: 'com.atproto.requestAccountPasswordReset',
    type: 'procedure',
    description: 'Initiate a user account password reset via email',
    parameters: {},
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
  {
    lexicon: 1,
    id: 'com.atproto.resetAccountPassword',
    type: 'procedure',
    description: 'Reset a user account password using a token',
    parameters: {},
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
  {
    lexicon: 1,
    id: 'com.atproto.resolveName',
    type: 'query',
    description: 'Provides the DID of a repo.',
    parameters: {
      name: {
        type: 'string',
        description:
          "The name to resolve. If not supplied, will resolve the host's own name.",
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.syncGetRepo',
    type: 'query',
    description: 'Gets the repo state.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
      from: {
        type: 'string',
        description: 'A past commit CID',
      },
    },
    output: {
      encoding: 'application/cbor',
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.syncGetRoot',
    type: 'query',
    description: 'Gets the current root CID of a repo.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['root'],
        properties: {
          root: {
            type: 'string',
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'com.atproto.syncUpdateRepo',
    type: 'procedure',
    description: 'Writes commits to a repo.',
    parameters: {
      did: {
        type: 'string',
        required: true,
        description: 'The DID of the repo.',
      },
    },
    input: {
      encoding: 'application/cbor',
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getAuthorFeed',
    type: 'query',
    description: "A view of a user's feed",
    parameters: {
      author: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['feed'],
        properties: {
          feed: {
            type: 'array',
            items: {
              $ref: '#/$defs/appBskyGetAuthorFeedFeedItem',
            },
          },
        },
        $defs: {
          appBskyGetAuthorFeedFeedItem: {
            type: 'object',
            required: [
              'cursor',
              'uri',
              'cid',
              'author',
              'record',
              'replyCount',
              'repostCount',
              'likeCount',
              'indexedAt',
            ],
            properties: {
              cursor: {
                type: 'string',
              },
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              author: {
                $ref: '#/$defs/appBskyGetAuthorFeedUser',
              },
              repostedBy: {
                $ref: '#/$defs/appBskyGetAuthorFeedUser',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/appBskyGetAuthorFeedRecordEmbed',
                  },
                  {
                    $ref: '#/$defs/appBskyGetAuthorFeedExternalEmbed',
                  },
                  {
                    $ref: '#/$defs/appBskyGetAuthorFeedUnknownEmbed',
                  },
                ],
              },
              replyCount: {
                type: 'number',
              },
              repostCount: {
                type: 'number',
              },
              likeCount: {
                type: 'number',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
              myState: {
                type: 'object',
                properties: {
                  repost: {
                    type: 'string',
                  },
                  like: {
                    type: 'string',
                  },
                },
              },
            },
          },
          appBskyGetAuthorFeedUser: {
            type: 'object',
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          appBskyGetAuthorFeedRecordEmbed: {
            type: 'object',
            required: ['type', 'author', 'record'],
            properties: {
              type: {
                const: 'record',
              },
              author: {
                $ref: '#/$defs/appBskyGetAuthorFeedUser',
              },
              record: {
                type: 'object',
              },
            },
          },
          appBskyGetAuthorFeedExternalEmbed: {
            type: 'object',
            required: ['type', 'uri', 'title', 'description', 'imageUri'],
            properties: {
              type: {
                const: 'external',
              },
              uri: {
                type: 'string',
              },
              title: {
                type: 'string',
              },
              description: {
                type: 'string',
              },
              imageUri: {
                type: 'string',
              },
            },
          },
          appBskyGetAuthorFeedUnknownEmbed: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                not: {
                  enum: ['record', 'external'],
                },
              },
            },
          },
        },
      },
    },
    defs: {
      feedItem: {
        type: 'object',
        required: [
          'cursor',
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'likeCount',
          'indexedAt',
        ],
        properties: {
          cursor: {
            type: 'string',
          },
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: {
            $ref: '#/$defs/appBskyGetAuthorFeedUser',
          },
          repostedBy: {
            $ref: '#/$defs/appBskyGetAuthorFeedUser',
          },
          record: {
            type: 'object',
          },
          embed: {
            oneOf: [
              {
                $ref: '#/$defs/appBskyGetAuthorFeedRecordEmbed',
              },
              {
                $ref: '#/$defs/appBskyGetAuthorFeedExternalEmbed',
              },
              {
                $ref: '#/$defs/appBskyGetAuthorFeedUnknownEmbed',
              },
            ],
          },
          replyCount: {
            type: 'number',
          },
          repostCount: {
            type: 'number',
          },
          likeCount: {
            type: 'number',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
          myState: {
            type: 'object',
            properties: {
              repost: {
                type: 'string',
              },
              like: {
                type: 'string',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'name'],
        properties: {
          did: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      recordEmbed: {
        type: 'object',
        required: ['type', 'author', 'record'],
        properties: {
          type: {
            const: 'record',
          },
          author: {
            $ref: '#/$defs/appBskyGetAuthorFeedUser',
          },
          record: {
            type: 'object',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
            const: 'external',
          },
          uri: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          imageUri: {
            type: 'string',
          },
        },
      },
      unknownEmbed: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            not: {
              enum: ['record', 'external'],
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getHomeFeed',
    type: 'query',
    description: "A view of the user's home feed",
    parameters: {
      algorithm: {
        type: 'string',
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['feed'],
        properties: {
          feed: {
            type: 'array',
            items: {
              $ref: '#/$defs/appBskyGetHomeFeedFeedItem',
            },
          },
        },
        $defs: {
          appBskyGetHomeFeedFeedItem: {
            type: 'object',
            required: [
              'cursor',
              'uri',
              'cid',
              'author',
              'record',
              'replyCount',
              'repostCount',
              'likeCount',
              'indexedAt',
            ],
            properties: {
              cursor: {
                type: 'string',
              },
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              author: {
                $ref: '#/$defs/appBskyGetHomeFeedUser',
              },
              repostedBy: {
                $ref: '#/$defs/appBskyGetHomeFeedUser',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/appBskyGetHomeFeedRecordEmbed',
                  },
                  {
                    $ref: '#/$defs/appBskyGetHomeFeedExternalEmbed',
                  },
                  {
                    $ref: '#/$defs/appBskyGetHomeFeedUnknownEmbed',
                  },
                ],
              },
              replyCount: {
                type: 'number',
              },
              repostCount: {
                type: 'number',
              },
              likeCount: {
                type: 'number',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
              myState: {
                type: 'object',
                properties: {
                  repost: {
                    type: 'string',
                  },
                  like: {
                    type: 'string',
                  },
                },
              },
            },
          },
          appBskyGetHomeFeedUser: {
            type: 'object',
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          appBskyGetHomeFeedRecordEmbed: {
            type: 'object',
            required: ['type', 'author', 'record'],
            properties: {
              type: {
                const: 'record',
              },
              author: {
                $ref: '#/$defs/appBskyGetHomeFeedUser',
              },
              record: {
                type: 'object',
              },
            },
          },
          appBskyGetHomeFeedExternalEmbed: {
            type: 'object',
            required: ['type', 'uri', 'title', 'description', 'imageUri'],
            properties: {
              type: {
                const: 'external',
              },
              uri: {
                type: 'string',
              },
              title: {
                type: 'string',
              },
              description: {
                type: 'string',
              },
              imageUri: {
                type: 'string',
              },
            },
          },
          appBskyGetHomeFeedUnknownEmbed: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                not: {
                  enum: ['record', 'external'],
                },
              },
            },
          },
        },
      },
    },
    defs: {
      feedItem: {
        type: 'object',
        required: [
          'cursor',
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'likeCount',
          'indexedAt',
        ],
        properties: {
          cursor: {
            type: 'string',
          },
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: {
            $ref: '#/$defs/appBskyGetHomeFeedUser',
          },
          repostedBy: {
            $ref: '#/$defs/appBskyGetHomeFeedUser',
          },
          record: {
            type: 'object',
          },
          embed: {
            oneOf: [
              {
                $ref: '#/$defs/appBskyGetHomeFeedRecordEmbed',
              },
              {
                $ref: '#/$defs/appBskyGetHomeFeedExternalEmbed',
              },
              {
                $ref: '#/$defs/appBskyGetHomeFeedUnknownEmbed',
              },
            ],
          },
          replyCount: {
            type: 'number',
          },
          repostCount: {
            type: 'number',
          },
          likeCount: {
            type: 'number',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
          myState: {
            type: 'object',
            properties: {
              repost: {
                type: 'string',
              },
              like: {
                type: 'string',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'name'],
        properties: {
          did: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      recordEmbed: {
        type: 'object',
        required: ['type', 'author', 'record'],
        properties: {
          type: {
            const: 'record',
          },
          author: {
            $ref: '#/$defs/appBskyGetHomeFeedUser',
          },
          record: {
            type: 'object',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
            const: 'external',
          },
          uri: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          imageUri: {
            type: 'string',
          },
        },
      },
      unknownEmbed: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            not: {
              enum: ['record', 'external'],
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getLikedBy',
    type: 'query',
    parameters: {
      uri: {
        type: 'string',
        required: true,
      },
      cid: {
        type: 'string',
        required: false,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri', 'likedBy'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          likedBy: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getNotificationCount',
    type: 'query',
    parameters: {},
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
  {
    lexicon: 1,
    id: 'app.bsky.getNotifications',
    type: 'query',
    parameters: {
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['notifications'],
        properties: {
          notifications: {
            type: 'array',
            items: {
              $ref: '#/$defs/appBskyGetNotificationsNotification',
            },
          },
        },
        $defs: {
          appBskyGetNotificationsNotification: {
            type: 'object',
            required: [
              'uri',
              'cid',
              'author',
              'reason',
              'record',
              'isRead',
              'indexedAt',
            ],
            properties: {
              uri: {
                type: 'string',
                format: 'uri',
              },
              cid: {
                type: 'string',
              },
              author: {
                type: 'object',
                required: ['did', 'name'],
                properties: {
                  did: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                  },
                  displayName: {
                    type: 'string',
                    maxLength: 64,
                  },
                },
              },
              reason: {
                type: 'string',
                $comment:
                  "Expected values are 'like', 'repost', 'follow', 'badge', 'mention' and 'reply'.",
              },
              reasonSubject: {
                type: 'string',
              },
              record: {
                type: 'object',
              },
              isRead: {
                type: 'boolean',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
        },
      },
    },
    defs: {
      notification: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'reason',
          'record',
          'isRead',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'uri',
          },
          cid: {
            type: 'string',
          },
          author: {
            type: 'object',
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          reason: {
            type: 'string',
            $comment:
              "Expected values are 'like', 'repost', 'follow', 'badge', 'mention' and 'reply'.",
          },
          reasonSubject: {
            type: 'string',
          },
          record: {
            type: 'object',
          },
          isRead: {
            type: 'boolean',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getPostThread',
    type: 'query',
    parameters: {
      uri: {
        type: 'string',
        required: true,
      },
      depth: {
        type: 'number',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['thread'],
        properties: {
          thread: {
            $ref: '#/$defs/appBskyGetPostThreadPost',
          },
        },
        $defs: {
          appBskyGetPostThreadPost: {
            type: 'object',
            required: [
              'uri',
              'cid',
              'author',
              'record',
              'replyCount',
              'likeCount',
              'repostCount',
              'indexedAt',
            ],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              author: {
                $ref: '#/$defs/appBskyGetPostThreadUser',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/appBskyGetPostThreadRecordEmbed',
                  },
                  {
                    $ref: '#/$defs/appBskyGetPostThreadExternalEmbed',
                  },
                  {
                    $ref: '#/$defs/appBskyGetPostThreadUnknownEmbed',
                  },
                ],
              },
              parent: {
                $ref: '#/$defs/appBskyGetPostThreadPost',
              },
              replyCount: {
                type: 'number',
              },
              replies: {
                type: 'array',
                items: {
                  $ref: '#/$defs/appBskyGetPostThreadPost',
                },
              },
              likeCount: {
                type: 'number',
              },
              repostCount: {
                type: 'number',
              },
              indexedAt: {
                type: 'string',
                format: 'date-time',
              },
              myState: {
                type: 'object',
                properties: {
                  repost: {
                    type: 'string',
                  },
                  like: {
                    type: 'string',
                  },
                },
              },
            },
          },
          appBskyGetPostThreadUser: {
            type: 'object',
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          appBskyGetPostThreadRecordEmbed: {
            type: 'object',
            required: ['type', 'author', 'record'],
            properties: {
              type: {
                const: 'record',
              },
              author: {
                $ref: '#/$defs/appBskyGetPostThreadUser',
              },
              record: {
                type: 'object',
              },
            },
          },
          appBskyGetPostThreadExternalEmbed: {
            type: 'object',
            required: ['type', 'uri', 'title', 'description', 'imageUri'],
            properties: {
              type: {
                const: 'external',
              },
              uri: {
                type: 'string',
              },
              title: {
                type: 'string',
              },
              description: {
                type: 'string',
              },
              imageUri: {
                type: 'string',
              },
            },
          },
          appBskyGetPostThreadUnknownEmbed: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                not: {
                  enum: ['record', 'external'],
                },
              },
            },
          },
        },
      },
    },
    defs: {
      post: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'likeCount',
          'repostCount',
          'indexedAt',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: {
            $ref: '#/$defs/appBskyGetPostThreadUser',
          },
          record: {
            type: 'object',
          },
          embed: {
            oneOf: [
              {
                $ref: '#/$defs/appBskyGetPostThreadRecordEmbed',
              },
              {
                $ref: '#/$defs/appBskyGetPostThreadExternalEmbed',
              },
              {
                $ref: '#/$defs/appBskyGetPostThreadUnknownEmbed',
              },
            ],
          },
          parent: {
            $ref: '#/$defs/appBskyGetPostThreadPost',
          },
          replyCount: {
            type: 'number',
          },
          replies: {
            type: 'array',
            items: {
              $ref: '#/$defs/appBskyGetPostThreadPost',
            },
          },
          likeCount: {
            type: 'number',
          },
          repostCount: {
            type: 'number',
          },
          indexedAt: {
            type: 'string',
            format: 'date-time',
          },
          myState: {
            type: 'object',
            properties: {
              repost: {
                type: 'string',
              },
              like: {
                type: 'string',
              },
            },
          },
        },
      },
      user: {
        type: 'object',
        required: ['did', 'name'],
        properties: {
          did: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      recordEmbed: {
        type: 'object',
        required: ['type', 'author', 'record'],
        properties: {
          type: {
            const: 'record',
          },
          author: {
            $ref: '#/$defs/appBskyGetPostThreadUser',
          },
          record: {
            type: 'object',
          },
        },
      },
      externalEmbed: {
        type: 'object',
        required: ['type', 'uri', 'title', 'description', 'imageUri'],
        properties: {
          type: {
            const: 'external',
          },
          uri: {
            type: 'string',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          imageUri: {
            type: 'string',
          },
        },
      },
      unknownEmbed: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            not: {
              enum: ['record', 'external'],
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getProfile',
    type: 'query',
    parameters: {
      user: {
        type: 'string',
        required: true,
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: [
          'did',
          'name',
          'followersCount',
          'followsCount',
          'postsCount',
          'badges',
        ],
        properties: {
          did: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          description: {
            type: 'string',
            maxLength: 256,
          },
          followersCount: {
            type: 'number',
          },
          followsCount: {
            type: 'number',
          },
          postsCount: {
            type: 'number',
          },
          badges: {
            type: 'array',
            items: {
              $ref: '#/$defs/appBskyGetProfileBadge',
            },
          },
          myState: {
            type: 'object',
            properties: {
              follow: {
                type: 'string',
              },
            },
          },
        },
        $defs: {
          appBskyGetProfileBadge: {
            type: 'object',
            required: ['uri', 'cid'],
            properties: {
              uri: {
                type: 'string',
              },
              cid: {
                type: 'string',
              },
              error: {
                type: 'string',
              },
              issuer: {
                type: 'object',
                required: ['did', 'name', 'displayName'],
                properties: {
                  did: {
                    type: 'string',
                  },
                  name: {
                    type: 'string',
                  },
                  displayName: {
                    type: 'string',
                    maxLength: 64,
                  },
                },
              },
              assertion: {
                type: 'object',
                required: ['type'],
                properties: {
                  type: {
                    type: 'string',
                  },
                },
              },
              createdAt: {
                type: 'string',
                format: 'date-time',
              },
            },
          },
        },
      },
    },
    defs: {
      badge: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          error: {
            type: 'string',
          },
          issuer: {
            type: 'object',
            required: ['did', 'name', 'displayName'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          assertion: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
              },
            },
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getRepostedBy',
    type: 'query',
    parameters: {
      uri: {
        type: 'string',
        required: true,
      },
      cid: {
        type: 'string',
        required: false,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri', 'repostedBy'],
        properties: {
          uri: {
            type: 'string',
          },
          repostedBy: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getUserFollowers',
    type: 'query',
    description: 'Who is following a user?',
    parameters: {
      user: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['subject', 'followers'],
        properties: {
          subject: {
            type: 'object',
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          followers: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getUserFollows',
    type: 'query',
    description: 'Who is a user following?',
    parameters: {
      user: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['subject', 'follows'],
        properties: {
          subject: {
            type: 'object',
            required: ['did', 'name'],
            properties: {
              did: {
                type: 'string',
              },
              name: {
                type: 'string',
              },
              displayName: {
                type: 'string',
                maxLength: 64,
              },
            },
          },
          follows: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'name', 'indexedAt'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },
        $defs: {},
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getUsersSearch',
    type: 'query',
    description: 'Find users matching search criteria',
    parameters: {
      term: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
      before: {
        type: 'string',
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['users'],
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'name', 'createdAt', 'indexedAt', 'cursor'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
                description: {
                  type: 'string',
                },
                createdAt: {
                  type: 'string',
                  format: 'date-time',
                },
                indexedAt: {
                  type: 'string',
                  format: 'date-time',
                },
                cursor: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.getUsersTypeahead',
    type: 'query',
    description: 'Find user suggestions for a search term',
    parameters: {
      term: {
        type: 'string',
        required: true,
      },
      limit: {
        type: 'number',
        maximum: 100,
      },
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['users'],
        properties: {
          users: {
            type: 'array',
            items: {
              type: 'object',
              required: ['did', 'name'],
              properties: {
                did: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
                displayName: {
                  type: 'string',
                  maxLength: 64,
                },
              },
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.postNotificationsSeen',
    type: 'procedure',
    description: 'Notify server that the user has seen notifications',
    parameters: {},
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
]
export const recordSchemas: RecordSchema[] = [
  {
    lexicon: 1,
    id: 'app.bsky.badge',
    type: 'record',
    description: 'An assertion about the subject by this user.',
    record: {
      type: 'object',
      required: ['assertion', 'subject', 'createdAt'],
      properties: {
        assertion: {
          oneOf: [
            {
              $ref: '#/$defs/appBskyBadgeInviteAssertion',
            },
            {
              $ref: '#/$defs/appBskyBadgeEmployeeAssertion',
            },
            {
              $ref: '#/$defs/appBskyBadgeTagAssertion',
            },
            {
              $ref: '#/$defs/appBskyBadgeUnknownAssertion',
            },
          ],
        },
        subject: {
          type: 'string',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        appBskyBadgeInviteAssertion: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              const: 'invite',
            },
          },
        },
        appBskyBadgeEmployeeAssertion: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              const: 'employee',
            },
          },
        },
        appBskyBadgeTagAssertion: {
          type: 'object',
          required: ['type', 'tag'],
          properties: {
            type: {
              const: 'tag',
            },
            tag: {
              type: 'string',
              maxLength: 64,
            },
          },
        },
        appBskyBadgeUnknownAssertion: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              not: {
                enum: ['invite', 'employee', 'tag'],
              },
            },
          },
        },
      },
    },
    defs: {
      inviteAssertion: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            const: 'invite',
          },
        },
      },
      employeeAssertion: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            const: 'employee',
          },
        },
      },
      tagAssertion: {
        type: 'object',
        required: ['type', 'tag'],
        properties: {
          type: {
            const: 'tag',
          },
          tag: {
            type: 'string',
            maxLength: 64,
          },
        },
      },
      unknownAssertion: {
        type: 'object',
        required: ['type'],
        properties: {
          type: {
            type: 'string',
            not: {
              enum: ['invite', 'employee', 'tag'],
            },
          },
        },
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.follow',
    type: 'record',
    description: 'A social follow',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          type: 'string',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {},
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.like',
    type: 'record',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/appBskyLikeSubject',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        appBskyLikeSubject: {
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
  {
    lexicon: 1,
    id: 'app.bsky.mediaEmbed',
    type: 'record',
    description: 'A list of media embedded in a post or document.',
    record: {
      type: 'object',
      required: ['media'],
      properties: {
        media: {
          type: 'array',
          items: {
            $ref: '#/$defs/appBskyMediaEmbedMediaEmbed',
          },
        },
      },
      $defs: {
        appBskyMediaEmbedMediaEmbed: {
          type: 'object',
          required: ['original'],
          properties: {
            alt: {
              type: 'string',
            },
            thumb: {
              $ref: '#/$defs/appBskyMediaEmbedMediaEmbedBlob',
            },
            original: {
              $ref: '#/$defs/appBskyMediaEmbedMediaEmbedBlob',
            },
          },
        },
        appBskyMediaEmbedMediaEmbedBlob: {
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
            $ref: '#/$defs/appBskyMediaEmbedMediaEmbedBlob',
          },
          original: {
            $ref: '#/$defs/appBskyMediaEmbedMediaEmbedBlob',
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
  {
    lexicon: 1,
    id: 'app.bsky.post',
    type: 'record',
    record: {
      type: 'object',
      required: ['text', 'createdAt'],
      properties: {
        text: {
          type: 'string',
          maxLength: 256,
        },
        entities: {
          $ref: '#/$defs/appBskyPostEntity',
        },
        reply: {
          type: 'object',
          required: ['root', 'parent'],
          properties: {
            root: {
              $ref: '#/$defs/appBskyPostPostRef',
            },
            parent: {
              $ref: '#/$defs/appBskyPostPostRef',
            },
          },
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        appBskyPostEntity: {
          type: 'array',
          items: {
            type: 'object',
            required: ['index', 'type', 'value'],
            properties: {
              index: {
                $ref: '#/$defs/appBskyPostTextSlice',
              },
              type: {
                type: 'string',
                $comment:
                  "Expected values are 'mention', 'hashtag', and 'link'.",
              },
              value: {
                type: 'string',
              },
            },
          },
        },
        appBskyPostTextSlice: {
          type: 'array',
          items: [
            {
              type: 'number',
            },
            {
              type: 'number',
            },
          ],
          minItems: 2,
          maxItems: 2,
        },
        appBskyPostPostRef: {
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
        type: 'array',
        items: {
          type: 'object',
          required: ['index', 'type', 'value'],
          properties: {
            index: {
              $ref: '#/$defs/appBskyPostTextSlice',
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
      },
      textSlice: {
        type: 'array',
        items: [
          {
            type: 'number',
          },
          {
            type: 'number',
          },
        ],
        minItems: 2,
        maxItems: 2,
      },
    },
  },
  {
    lexicon: 1,
    id: 'app.bsky.profile',
    type: 'record',
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
        badges: {
          type: 'array',
          items: {
            $ref: '#/$defs/appBskyProfileBadgeRef',
          },
        },
      },
      $defs: {
        appBskyProfileBadgeRef: {
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
      badgeRef: {
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
  {
    lexicon: 1,
    id: 'app.bsky.repost',
    type: 'record',
    record: {
      type: 'object',
      required: ['subject', 'createdAt'],
      properties: {
        subject: {
          $ref: '#/$defs/appBskyRepostSubject',
        },
        createdAt: {
          type: 'string',
          format: 'date-time',
        },
      },
      $defs: {
        appBskyRepostSubject: {
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
]
