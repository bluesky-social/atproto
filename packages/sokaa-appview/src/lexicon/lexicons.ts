/**
 * GENERATED CODE - DO NOT MODIFY
 */
import {
  type LexiconDoc,
  Lexicons,
  ValidationError,
  type ValidationResult,
} from '@atproto/lexicon'
import { type $Typed, is$typed, maybe$typed } from './util.js'

export const schemaDict = {
  AppSokaaActorDefs: {
    lexicon: 1,
    id: 'app.sokaa.actor.defs',
    defs: {
      profileViewBasic: {
        type: 'object',
        description:
          'Minimal actor information, used when embedding author info in post views.',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          displayName: {
            type: 'string',
            maxGraphemes: 64,
            maxLength: 640,
          },
          avatar: {
            type: 'string',
            format: 'uri',
            description: 'CDN URL of the avatar image.',
          },
        },
      },
      profileView: {
        type: 'object',
        description:
          'Full profile view, returned by app.sokaa.actor.getProfile.',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
            format: 'handle',
          },
          displayName: {
            type: 'string',
            maxGraphemes: 64,
            maxLength: 640,
          },
          description: {
            type: 'string',
            maxGraphemes: 256,
            maxLength: 2560,
          },
          avatar: {
            type: 'string',
            format: 'uri',
          },
          banner: {
            type: 'string',
            format: 'uri',
          },
          website: {
            type: 'string',
            format: 'uri',
          },
          followersCount: {
            type: 'integer',
            minimum: 0,
          },
          followsCount: {
            type: 'integer',
            minimum: 0,
          },
          postsCount: {
            type: 'integer',
            minimum: 0,
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.sokaa.actor.defs#viewerState',
            description:
              'Relationship between the authenticated user and this profile.',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      viewerState: {
        type: 'object',
        description: "Authenticated viewer's relationship to this actor.",
        properties: {
          following: {
            type: 'string',
            format: 'at-uri',
            description:
              "AT-URI of the viewer's follow record for this actor, if they follow them.",
          },
          followedBy: {
            type: 'string',
            format: 'at-uri',
            description:
              "AT-URI of this actor's follow record for the viewer, if they follow back.",
          },
        },
      },
    },
  },
  AppSokaaActorGetProfile: {
    lexicon: 1,
    id: 'app.sokaa.actor.getProfile',
    defs: {
      main: {
        type: 'query',
        description:
          'Get a full profile view for an actor. Publicly accessible.',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description: 'The handle or DID of the account to fetch.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:app.sokaa.actor.defs#profileView',
          },
        },
      },
    },
  },
  AppSokaaActorProfile: {
    lexicon: 1,
    id: 'app.sokaa.actor.profile',
    defs: {
      main: {
        type: 'record',
        description:
          "A Sokaa user profile. One record per account, stored at key 'self'.",
        key: 'literal:self',
        record: {
          type: 'object',
          properties: {
            displayName: {
              type: 'string',
              maxGraphemes: 64,
              maxLength: 640,
            },
            description: {
              type: 'string',
              description: 'A short bio displayed on the profile.',
              maxGraphemes: 256,
              maxLength: 2560,
            },
            avatar: {
              type: 'blob',
              description: 'Profile picture.',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            banner: {
              type: 'blob',
              description: 'Profile banner image.',
              accept: ['image/png', 'image/jpeg'],
              maxSize: 1000000,
            },
            website: {
              type: 'string',
              format: 'uri',
              description: 'Optional external website URL.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppSokaaEmbedImages: {
    lexicon: 1,
    id: 'app.sokaa.embed.images',
    description: 'One or more images embedded in a Sokaa post.',
    defs: {
      main: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.sokaa.embed.images#image',
            },
            minLength: 1,
            maxLength: 8,
          },
        },
      },
      image: {
        type: 'object',
        required: ['image', 'alt'],
        properties: {
          image: {
            type: 'blob',
            accept: ['image/png', 'image/jpeg', 'image/webp'],
            maxSize: 10000000,
          },
          alt: {
            type: 'string',
            description: 'Alt text for the image, for accessibility.',
            maxGraphemes: 1000,
            maxLength: 10000,
          },
          aspectRatio: {
            type: 'ref',
            ref: 'lex:app.sokaa.embed.video#aspectRatio',
          },
        },
      },
      view: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.sokaa.embed.images#viewImage',
            },
            minLength: 1,
            maxLength: 8,
          },
        },
      },
      viewImage: {
        type: 'object',
        required: ['thumb', 'fullsize', 'alt'],
        properties: {
          thumb: {
            type: 'string',
            format: 'uri',
          },
          fullsize: {
            type: 'string',
            format: 'uri',
          },
          alt: {
            type: 'string',
            maxGraphemes: 1000,
            maxLength: 10000,
          },
          aspectRatio: {
            type: 'ref',
            ref: 'lex:app.sokaa.embed.video#aspectRatio',
          },
        },
      },
    },
  },
  AppSokaaEmbedVideo: {
    lexicon: 1,
    id: 'app.sokaa.embed.video',
    description: 'A video embedded in a Sokaa post.',
    defs: {
      main: {
        type: 'object',
        required: ['video'],
        properties: {
          video: {
            type: 'blob',
            description:
              'The video file. Maximum 500MB (supports up to 4K resolution).',
            accept: ['video/mp4'],
            maxSize: 500000000,
          },
          thumbnail: {
            type: 'blob',
            description: 'A still image preview frame for the video.',
            accept: ['image/jpeg', 'image/png'],
            maxSize: 1000000,
          },
          alt: {
            type: 'string',
            description:
              'Alt text description of the video, for accessibility.',
            maxGraphemes: 1000,
            maxLength: 10000,
          },
          duration: {
            type: 'integer',
            description: 'Duration of the video in seconds.',
            minimum: 0,
          },
          aspectRatio: {
            type: 'ref',
            ref: 'lex:app.sokaa.embed.video#aspectRatio',
          },
        },
      },
      aspectRatio: {
        type: 'object',
        description: 'Width:height ratio of the video frame.',
        required: ['width', 'height'],
        properties: {
          width: {
            type: 'integer',
            minimum: 1,
          },
          height: {
            type: 'integer',
            minimum: 1,
          },
        },
      },
      view: {
        type: 'object',
        description: 'Hydrated video view returned by the AppView.',
        required: ['cid', 'playlist'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          playlist: {
            type: 'string',
            format: 'uri',
            description: 'HLS/DASH playlist URL served by the media CDN.',
          },
          thumbnail: {
            type: 'string',
            format: 'uri',
          },
          alt: {
            type: 'string',
            maxGraphemes: 1000,
            maxLength: 10000,
          },
          duration: {
            type: 'integer',
            minimum: 0,
          },
          aspectRatio: {
            type: 'ref',
            ref: 'lex:app.sokaa.embed.video#aspectRatio',
          },
        },
      },
    },
  },
  AppSokaaFeedDefs: {
    lexicon: 1,
    id: 'app.sokaa.feed.defs',
    defs: {
      postView: {
        type: 'object',
        description:
          'A fully hydrated view of a Sokaa post, as returned by the AppView.',
        required: ['uri', 'cid', 'author', 'record', 'indexedAt'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          author: {
            type: 'ref',
            ref: 'lex:app.sokaa.actor.defs#profileViewBasic',
          },
          record: {
            type: 'ref',
            ref: 'lex:app.sokaa.feed.post',
            description: 'The raw app.sokaa.feed.post record.',
          },
          embed: {
            type: 'union',
            description: 'Hydrated media embed (CDN URLs resolved).',
            refs: [
              'lex:app.sokaa.embed.video#view',
              'lex:app.sokaa.embed.images#view',
            ],
          },
          likeCount: {
            type: 'integer',
            minimum: 0,
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.sokaa.feed.defs#viewerState',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      feedViewPost: {
        type: 'object',
        description: 'A post as it appears in a feed list response.',
        required: ['post'],
        properties: {
          post: {
            type: 'ref',
            ref: 'lex:app.sokaa.feed.defs#postView',
          },
        },
      },
      viewerState: {
        type: 'object',
        description: "Authenticated viewer's interaction state with a post.",
        properties: {
          like: {
            type: 'string',
            format: 'at-uri',
            description:
              "AT-URI of the viewer's like record for this post, if they liked it.",
          },
        },
      },
    },
  },
  AppSokaaFeedGetAuthorFeed: {
    lexicon: 1,
    id: 'app.sokaa.feed.getAuthorFeed',
    defs: {
      main: {
        type: 'query',
        description:
          'Get a list of posts by a specific actor, newest first. Publicly accessible.',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
              format: 'at-identifier',
              description:
                'The handle or DID of the account whose posts to fetch.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
            },
            cursor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feed'],
            properties: {
              cursor: {
                type: 'string',
              },
              feed: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.sokaa.feed.defs#feedViewPost',
                },
              },
            },
          },
        },
      },
    },
  },
  AppSokaaFeedGetTimeline: {
    lexicon: 1,
    id: 'app.sokaa.feed.getTimeline',
    defs: {
      main: {
        type: 'query',
        description:
          'Get the home timeline for the authenticated user — posts from accounts they follow, newest first.',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              description: 'Maximum number of posts to return.',
              minimum: 1,
              maximum: 100,
              default: 30,
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor from a previous response.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['feed'],
            properties: {
              cursor: {
                type: 'string',
              },
              feed: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.sokaa.feed.defs#feedViewPost',
                },
              },
            },
          },
        },
      },
    },
  },
  AppSokaaFeedLike: {
    lexicon: 1,
    id: 'app.sokaa.feed.like',
    defs: {
      main: {
        type: 'record',
        description:
          "Record declaring a like of a Sokaa post. Stored in the liker's repo.",
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
              description:
                'The post being liked, identified by its AT-URI and CID.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
  AppSokaaFeedPost: {
    lexicon: 1,
    id: 'app.sokaa.feed.post',
    defs: {
      main: {
        type: 'record',
        description:
          'A Sokaa post. Media (video or images) is required; caption is optional.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['media', 'createdAt'],
          properties: {
            caption: {
              type: 'string',
              description: 'Optional caption displayed below the media.',
              maxGraphemes: 300,
              maxLength: 3000,
            },
            media: {
              type: 'union',
              description:
                'The primary media content of the post. Must be a video or one or more images.',
              refs: ['lex:app.sokaa.embed.video', 'lex:app.sokaa.embed.images'],
            },
            tags: {
              type: 'array',
              description: 'Hashtags associated with the post.',
              maxLength: 8,
              items: {
                type: 'string',
                maxGraphemes: 64,
                maxLength: 640,
              },
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
              description:
                'Client-declared timestamp when this post was originally created.',
            },
          },
        },
      },
    },
  },
  AppSokaaGraphFollow: {
    lexicon: 1,
    id: 'app.sokaa.graph.follow',
    defs: {
      main: {
        type: 'record',
        description:
          "Record declaring a follow relationship. Stored in the follower's repo; subject is the DID of the account being followed.",
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'string',
              format: 'did',
              description: 'The DID of the account being followed.',
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
    },
  },
} as const satisfies Record<string, LexiconDoc>
export const schemas = Object.values(schemaDict) satisfies LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)

export function validate<T extends { $type: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType: true,
): ValidationResult<T>
export function validate<T extends { $type?: string }>(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: false,
): ValidationResult<T>
export function validate(
  v: unknown,
  id: string,
  hash: string,
  requiredType?: boolean,
): ValidationResult {
  return (requiredType ? is$typed : maybe$typed)(v, id, hash)
    ? lexicons.validate(`${id}#${hash}`, v)
    : {
        success: false,
        error: new ValidationError(
          `Must be an object with "${hash === 'main' ? id : `${id}#${hash}`}" $type property`,
        ),
      }
}

export const ids = {
  AppSokaaActorDefs: 'app.sokaa.actor.defs',
  AppSokaaActorGetProfile: 'app.sokaa.actor.getProfile',
  AppSokaaActorProfile: 'app.sokaa.actor.profile',
  AppSokaaEmbedImages: 'app.sokaa.embed.images',
  AppSokaaEmbedVideo: 'app.sokaa.embed.video',
  AppSokaaFeedDefs: 'app.sokaa.feed.defs',
  AppSokaaFeedGetAuthorFeed: 'app.sokaa.feed.getAuthorFeed',
  AppSokaaFeedGetTimeline: 'app.sokaa.feed.getTimeline',
  AppSokaaFeedLike: 'app.sokaa.feed.like',
  AppSokaaFeedPost: 'app.sokaa.feed.post',
  AppSokaaGraphFollow: 'app.sokaa.graph.follow',
} as const
