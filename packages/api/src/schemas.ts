/**
* GENERATED CODE - DO NOT MODIFY
* Created Tue Sep 20 2022
*/
import { MethodSchema } from '@adxp/xrpc'
import { AdxSchemaDefinition } from '@adxp/schemas'

export const methodSchemas: MethodSchema[] = [
  {
    xrpc: 1,
    id: 'todo.adx.createAccount',
    type: 'procedure',
    description: 'Create an account.',
    parameters: {},
    input: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['username', 'did'],
        properties: {
          username: {
            type: 'string',
          },
          did: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.createSession',
    type: 'procedure',
    description: 'Create an authentication session.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.deleteAccount',
    type: 'procedure',
    description: 'Delete an account.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.deleteSession',
    type: 'procedure',
    description: 'Delete the current session.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.getAccount',
    type: 'query',
    description: 'Get information about an account.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.getSession',
    type: 'query',
    description: 'Get information about the current session.',
    parameters: {},
    input: {
      encoding: '',
      schema: {},
    },
    output: {
      encoding: '',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoBatchWrite',
    type: 'procedure',
    description: 'Apply a batch transaction of creates, puts, and deletes.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      validate: {
        type: 'boolean',
        description: 'Validate the records?',
        default: true,
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
      },
    },
    output: {
      encoding: 'application/json',
      schema: {},
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoCreateRecord',
    type: 'procedure',
    description: 'Create a new record.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      validate: {
        type: 'boolean',
        description: 'Validate the record?',
        default: true,
      },
    },
    input: {
      encoding: 'application/json',
      schema: {},
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoDeleteRecord',
    type: 'procedure',
    description: 'Delete a record.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      tid: {
        type: 'string',
        description: 'The TID of the record.',
        required: true,
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoDescribe',
    type: 'query',
    description:
      'Get information about the repo, including the list of collections.',
    parameters: {
      nameOrDid: {
        type: 'string',
        description: 'The username or DID of the repo.',
        required: true,
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
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoGetRecord',
    type: 'query',
    description: 'Fetch a record.',
    parameters: {
      nameOrDid: {
        type: 'string',
        description: 'The name or DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      tid: {
        type: 'string',
        description: 'The TID of the record.',
        required: true,
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
          value: {
            type: 'object',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoListRecords',
    type: 'query',
    description: 'List a range of records in a collection.',
    parameters: {
      nameOrDid: {
        type: 'string',
        description: 'The username or DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      limit: {
        type: 'number',
        description: 'The number of records to return. TODO-max number?',
        default: 50,
        minimum: 1,
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
              required: ['uri', 'value'],
              properties: {
                uri: {
                  type: 'string',
                },
                value: {
                  type: 'object',
                },
              },
            },
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.repoPutRecord',
    type: 'procedure',
    description: 'Write a record.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
      type: {
        type: 'string',
        description: 'The NSID of the record type.',
        required: true,
      },
      tid: {
        type: 'string',
        description: 'The TID of the record.',
        required: true,
      },
      validate: {
        type: 'boolean',
        description: 'Validate the record?',
        default: true,
      },
    },
    input: {
      encoding: 'application/json',
      schema: {},
    },
    output: {
      encoding: 'application/json',
      schema: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
          },
        },
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.resolveName',
    type: 'query',
    description:
      'Provides the DID of the repo indicated by the Host parameter.',
    parameters: {
      name: {
        type: 'string',
        description: 'The name to resolve.',
        required: true,
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
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.syncGetRepo',
    type: 'query',
    description: 'Gets the repo state.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
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
    xrpc: 1,
    id: 'todo.adx.syncGetRoot',
    type: 'query',
    description: 'Gets the current root CID of a repo.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
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
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.adx.syncUpdateRepo',
    type: 'procedure',
    description: 'Writes commits to a repo.',
    parameters: {
      did: {
        type: 'string',
        description: 'The DID of the repo.',
        required: true,
      },
    },
    input: {
      encoding: 'application/cbor',
    },
  },
  {
    xrpc: 1,
    id: 'todo.social.getFeed',
    type: 'query',
    description: "A computed view of the home feed or a user's feed",
    parameters: {
      author: {
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
              $ref: '#/$defs/feedItem',
            },
          },
        },
        $defs: {
          feedItem: {
            type: 'object',
            required: [
              'uri',
              'author',
              'record',
              'replyCount',
              'repostCount',
              'likeCount',
              'indexedAt',
            ],
            properties: {
              uri: {
                type: 'string',
              },
              author: {
                $ref: '#/$defs/user',
              },
              repostedBy: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/recordEmbed',
                  },
                  {
                    $ref: '#/$defs/externalEmbed',
                  },
                  {
                    $ref: '#/$defs/unknownEmbed',
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
                $ref: '#/$defs/user',
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
    },
  },
  {
    xrpc: 1,
    id: 'todo.social.getLikedBy',
    type: 'query',
    parameters: {
      uri: {
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
        required: ['uri', 'likedBy'],
        properties: {
          uri: {
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
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.social.getNotifications',
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
              $ref: '#/$defs/notification',
            },
          },
        },
        $defs: {
          notification: {
            type: 'object',
            required: ['uri', 'author', 'record', 'isRead', 'indexedAt'],
            properties: {
              uri: {
                type: 'string',
                format: 'uri',
              },
              author: {
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
  },
  {
    xrpc: 1,
    id: 'todo.social.getPostThread',
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
            $ref: '#/$defs/post',
          },
        },
        $defs: {
          post: {
            type: 'object',
            required: [
              'uri',
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
              author: {
                $ref: '#/$defs/user',
              },
              record: {
                type: 'object',
              },
              embed: {
                oneOf: [
                  {
                    $ref: '#/$defs/recordEmbed',
                  },
                  {
                    $ref: '#/$defs/externalEmbed',
                  },
                  {
                    $ref: '#/$defs/unknownEmbed',
                  },
                ],
              },
              parent: {
                $ref: '#/$defs/post',
              },
              replyCount: {
                type: 'number',
              },
              replies: {
                type: 'array',
                items: {
                  $ref: '#/$defs/post',
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
                $ref: '#/$defs/user',
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
    },
  },
  {
    xrpc: 1,
    id: 'todo.social.getProfile',
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
              $ref: '#/$defs/badge',
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
          badge: {
            type: 'object',
            required: ['uri'],
            properties: {
              uri: {
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
  },
  {
    xrpc: 1,
    id: 'todo.social.getRepostedBy',
    type: 'query',
    parameters: {
      uri: {
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
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.social.getUserFollowers',
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
      },
    },
  },
  {
    xrpc: 1,
    id: 'todo.social.getUserFollows',
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
      },
    },
  },
]
export const recordSchemas: AdxSchemaDefinition[] = [
  {
    adx: 1,
    id: 'todo.social.badge',
    description: 'An assertion about the subject by this user.',
    record: {
      type: 'object',
      required: ['assertion', 'subject', 'createdAt'],
      properties: {
        assertion: {
          oneOf: [
            {
              $ref: '#/$defs/inviteAssertion',
            },
            {
              $ref: '#/$defs/employeeAssertion',
            },
            {
              $ref: '#/$defs/tagAssertion',
            },
            {
              $ref: '#/$defs/unknownAssertion',
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
  },
  {
    adx: 1,
    id: 'todo.social.follow',
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
    },
  },
  {
    adx: 1,
    id: 'todo.social.like',
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
    },
  },
  {
    adx: 1,
    id: 'todo.social.mediaEmbed',
    description: 'A list of media embedded in a post or document.',
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
  },
  {
    adx: 1,
    id: 'todo.social.post',
    record: {
      type: 'object',
      required: ['text', 'createdAt'],
      properties: {
        text: {
          type: 'string',
          maxLength: 256,
        },
        entities: {
          $ref: '#/$defs/entity',
        },
        reply: {
          type: 'object',
          required: ['root'],
          properties: {
            root: {
              type: 'string',
            },
            parent: {
              type: 'string',
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
          type: 'array',
          items: {
            type: 'object',
            required: ['index', 'type', 'value'],
            properties: {
              index: {
                $ref: '#/$defs/textSlice',
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
  },
  {
    adx: 1,
    id: 'todo.social.profile',
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
            $ref: '#/$defs/badgeRef',
          },
        },
      },
      $defs: {
        badgeRef: {
          type: 'object',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
            },
          },
        },
      },
    },
  },
  {
    adx: 1,
    id: 'todo.social.repost',
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
    },
  },
]
