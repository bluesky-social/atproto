/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { LexiconDoc, Lexicons } from '@atproto/lexicon'

export const schemaDict = {
  ComAtprotoAccountCreate: {
    lexicon: 1,
    id: 'com.atproto.account.create',
    defs: {
      main: {
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
                format: 'did',
              },
            },
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
    },
  },
  ComAtprotoAccountCreateInviteCode: {
    lexicon: 1,
    id: 'com.atproto.account.createInviteCode',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an invite code.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['useCount'],
            properties: {
              useCount: {
                type: 'integer',
              },
            },
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
          },
        },
      },
    },
  },
  ComAtprotoAccountDelete: {
    lexicon: 1,
    id: 'com.atproto.account.delete',
    defs: {
      main: {
        type: 'procedure',
        description: 'Delete a user account with a token and password.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['did', 'password', 'token'],
            properties: {
              did: {
                type: 'string',
                format: 'did',
              },
              password: {
                type: 'string',
              },
              token: {
                type: 'string',
              },
            },
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
    },
  },
  ComAtprotoAccountGet: {
    lexicon: 1,
    id: 'com.atproto.account.get',
    defs: {
      main: {
        type: 'query',
        description: 'Get information about an account.',
      },
    },
  },
  ComAtprotoAccountRequestDelete: {
    lexicon: 1,
    id: 'com.atproto.account.requestDelete',
    defs: {
      main: {
        type: 'procedure',
        description: 'Initiate a user account deletion via email.',
      },
    },
  },
  ComAtprotoAccountRequestPasswordReset: {
    lexicon: 1,
    id: 'com.atproto.account.requestPasswordReset',
    defs: {
      main: {
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
          },
        },
      },
    },
  },
  ComAtprotoAccountResetPassword: {
    lexicon: 1,
    id: 'com.atproto.account.resetPassword',
    defs: {
      main: {
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
    },
  },
  ComAtprotoAdminBlob: {
    lexicon: 1,
    id: 'com.atproto.admin.blob',
    defs: {
      view: {
        type: 'object',
        required: ['cid', 'mimeType', 'size', 'createdAt'],
        properties: {
          cid: {
            type: 'string',
            format: 'cid',
          },
          mimeType: {
            type: 'string',
          },
          size: {
            type: 'integer',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          details: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.blob#imageDetails',
              'lex:com.atproto.admin.blob#videoDetails',
            ],
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.blob#moderation',
          },
        },
      },
      imageDetails: {
        type: 'object',
        required: ['width', 'height'],
        properties: {
          width: {
            type: 'integer',
          },
          height: {
            type: 'integer',
          },
        },
      },
      videoDetails: {
        type: 'object',
        required: ['width', 'height', 'length'],
        properties: {
          width: {
            type: 'integer',
          },
          height: {
            type: 'integer',
          },
          length: {
            type: 'integer',
          },
        },
      },
      moderation: {
        type: 'object',
        required: [],
        properties: {
          currentAction: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#viewCurrent',
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationAction: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationAction',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a moderation action.',
        parameters: {
          type: 'params',
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#viewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationActions: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationActions',
    defs: {
      main: {
        type: 'query',
        description: 'List moderation actions related to a subject.',
        parameters: {
          type: 'params',
          properties: {
            subject: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['actions'],
            properties: {
              cursor: {
                type: 'string',
              },
              actions: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.admin.moderationAction#view',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationReport: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationReport',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a moderation report.',
        parameters: {
          type: 'params',
          required: ['id'],
          properties: {
            id: {
              type: 'integer',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationReport#viewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminGetModerationReports: {
    lexicon: 1,
    id: 'com.atproto.admin.getModerationReports',
    defs: {
      main: {
        type: 'query',
        description: 'List moderation reports related to a subject.',
        parameters: {
          type: 'params',
          properties: {
            subject: {
              type: 'string',
            },
            resolved: {
              type: 'boolean',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['reports'],
            properties: {
              cursor: {
                type: 'string',
              },
              reports: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.admin.moderationReport#view',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminGetRecord: {
    lexicon: 1,
    id: 'com.atproto.admin.getRecord',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a record.',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            cid: {
              type: 'string',
              format: 'cid',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.record#viewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminGetRepo: {
    lexicon: 1,
    id: 'com.atproto.admin.getRepo',
    defs: {
      main: {
        type: 'query',
        description: 'View details about a repository.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.repo#viewDetail',
          },
        },
      },
    },
  },
  ComAtprotoAdminModerationAction: {
    lexicon: 1,
    id: 'com.atproto.admin.moderationAction',
    defs: {
      view: {
        type: 'object',
        required: [
          'id',
          'action',
          'subject',
          'subjectBlobCids',
          'reason',
          'createdBy',
          'createdAt',
          'resolvedReportIds',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          action: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#actionType',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.repo.repoRef',
              'lex:com.atproto.repo.strongRef',
            ],
          },
          subjectBlobCids: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          reason: {
            type: 'string',
          },
          createdBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          reversal: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#reversal',
          },
          resolvedReportIds: {
            type: 'array',
            items: {
              type: 'integer',
            },
          },
        },
      },
      viewDetail: {
        type: 'object',
        required: [
          'id',
          'action',
          'subject',
          'subjectBlobs',
          'reason',
          'createdBy',
          'createdAt',
          'resolvedReports',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          action: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#actionType',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.repo#view',
              'lex:com.atproto.admin.record#view',
            ],
          },
          subjectBlobs: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.blob#view',
            },
          },
          reason: {
            type: 'string',
          },
          createdBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          reversal: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#reversal',
          },
          resolvedReports: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.moderationReport#view',
            },
          },
        },
      },
      viewCurrent: {
        type: 'object',
        required: ['id', 'action'],
        properties: {
          id: {
            type: 'integer',
          },
          action: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#actionType',
          },
        },
      },
      reversal: {
        type: 'object',
        required: ['reason', 'createdBy', 'createdAt'],
        properties: {
          reason: {
            type: 'string',
          },
          createdBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
      actionType: {
        type: 'string',
        knownValues: [
          'com.atproto.admin.moderationAction#takedown',
          'com.atproto.admin.moderationAction#flag',
          'com.atproto.admin.moderationAction#acknowledge',
        ],
      },
      takedown: {
        type: 'token',
        description:
          'Moderation action type: Takedown. Indicates that content should not be served by the PDS.',
      },
      flag: {
        type: 'token',
        description:
          'Moderation action type: Flag. Indicates that the content was reviewed and considered to violate PDS rules, but may still be served.',
      },
      acknowledge: {
        type: 'token',
        description:
          'Moderation action type: Acknowledge. Indicates that the content was reviewed and not considered to violate PDS rules.',
      },
    },
  },
  ComAtprotoAdminModerationReport: {
    lexicon: 1,
    id: 'com.atproto.admin.moderationReport',
    defs: {
      view: {
        type: 'object',
        required: [
          'id',
          'reasonType',
          'subject',
          'reportedBy',
          'createdAt',
          'resolvedByActionIds',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          reasonType: {
            type: 'ref',
            ref: 'lex:com.atproto.report.reasonType',
          },
          reason: {
            type: 'string',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.repo.repoRef',
              'lex:com.atproto.repo.strongRef',
            ],
          },
          reportedBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          resolvedByActionIds: {
            type: 'array',
            items: {
              type: 'integer',
            },
          },
        },
      },
      viewDetail: {
        type: 'object',
        required: [
          'id',
          'reasonType',
          'subject',
          'reportedBy',
          'createdAt',
          'resolvedByActions',
        ],
        properties: {
          id: {
            type: 'integer',
          },
          reasonType: {
            type: 'ref',
            ref: 'lex:com.atproto.report.reasonType',
          },
          reason: {
            type: 'string',
          },
          subject: {
            type: 'union',
            refs: [
              'lex:com.atproto.admin.repo#view',
              'lex:com.atproto.admin.record#view',
            ],
          },
          reportedBy: {
            type: 'string',
            format: 'did',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          resolvedByActions: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.moderationAction#view',
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminRecord: {
    lexicon: 1,
    id: 'com.atproto.admin.record',
    defs: {
      view: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'value',
          'blobCids',
          'indexedAt',
          'moderation',
          'repo',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          value: {
            type: 'unknown',
          },
          blobCids: {
            type: 'array',
            items: {
              type: 'string',
              format: 'cid',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.record#moderation',
          },
          repo: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.repo#view',
          },
        },
      },
      viewDetail: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'value',
          'blobs',
          'indexedAt',
          'moderation',
          'repo',
        ],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          value: {
            type: 'unknown',
          },
          blobs: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.blob#view',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.record#moderationDetail',
          },
          repo: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.repo#view',
          },
        },
      },
      moderation: {
        type: 'object',
        required: [],
        properties: {
          currentAction: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#viewCurrent',
          },
        },
      },
      moderationDetail: {
        type: 'object',
        required: ['actions', 'reports'],
        properties: {
          currentAction: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#viewCurrent',
          },
          actions: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.moderationAction#view',
            },
          },
          reports: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.moderationReport#view',
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminRepo: {
    lexicon: 1,
    id: 'com.atproto.admin.repo',
    defs: {
      view: {
        type: 'object',
        required: [
          'did',
          'handle',
          'relatedRecords',
          'indexedAt',
          'moderation',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          account: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.repo#account',
          },
          relatedRecords: {
            type: 'array',
            items: {
              type: 'unknown',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.repo#moderation',
          },
        },
      },
      viewDetail: {
        type: 'object',
        required: [
          'did',
          'handle',
          'relatedRecords',
          'indexedAt',
          'moderation',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          account: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.repo#account',
          },
          relatedRecords: {
            type: 'array',
            items: {
              type: 'unknown',
            },
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          moderation: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.repo#moderationDetail',
          },
        },
      },
      account: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
          },
        },
      },
      moderation: {
        type: 'object',
        required: [],
        properties: {
          currentAction: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#viewCurrent',
          },
        },
      },
      moderationDetail: {
        type: 'object',
        required: ['actions', 'reports'],
        properties: {
          currentAction: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#viewCurrent',
          },
          actions: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.moderationAction#view',
            },
          },
          reports: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:com.atproto.admin.moderationReport#view',
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminResolveModerationReports: {
    lexicon: 1,
    id: 'com.atproto.admin.resolveModerationReports',
    defs: {
      main: {
        type: 'procedure',
        description: 'Resolve moderation reports by an action.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actionId', 'reportIds', 'createdBy'],
            properties: {
              actionId: {
                type: 'integer',
              },
              reportIds: {
                type: 'array',
                items: {
                  type: 'integer',
                },
              },
              createdBy: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#view',
          },
        },
      },
    },
  },
  ComAtprotoAdminReverseModerationAction: {
    lexicon: 1,
    id: 'com.atproto.admin.reverseModerationAction',
    defs: {
      main: {
        type: 'procedure',
        description: 'Reverse a moderation action.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['id', 'reason', 'createdBy'],
            properties: {
              id: {
                type: 'integer',
              },
              reason: {
                type: 'string',
              },
              createdBy: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#view',
          },
        },
      },
    },
  },
  ComAtprotoAdminSearchRepos: {
    lexicon: 1,
    id: 'com.atproto.admin.searchRepos',
    defs: {
      main: {
        type: 'query',
        description: 'Find repositories based on a search term.',
        parameters: {
          type: 'params',
          properties: {
            term: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['repos'],
            properties: {
              cursor: {
                type: 'string',
              },
              repos: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.admin.repo#view',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoAdminTakeModerationAction: {
    lexicon: 1,
    id: 'com.atproto.admin.takeModerationAction',
    defs: {
      main: {
        type: 'procedure',
        description: 'Take a moderation action on a repo.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['action', 'subject', 'reason', 'createdBy'],
            properties: {
              action: {
                type: 'string',
                knownValues: [
                  'com.atproto.admin.moderationAction#takedown',
                  'com.atproto.admin.moderationAction#flag',
                  'com.atproto.admin.moderationAction#acknowledge',
                ],
              },
              subject: {
                type: 'union',
                refs: [
                  'lex:com.atproto.repo.repoRef',
                  'lex:com.atproto.repo.recordRef',
                ],
              },
              subjectBlobCids: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'cid',
                },
              },
              reason: {
                type: 'string',
              },
              createdBy: {
                type: 'string',
                format: 'did',
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:com.atproto.admin.moderationAction#view',
          },
        },
        errors: [
          {
            name: 'SubjectHasAction',
          },
        ],
      },
    },
  },
  ComAtprotoBlobUpload: {
    lexicon: 1,
    id: 'com.atproto.blob.upload',
    defs: {
      main: {
        type: 'procedure',
        description:
          'Upload a new blob to be added to repo in a later request.',
        input: {
          encoding: '*/*',
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['cid'],
            properties: {
              cid: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoHandleResolve: {
    lexicon: 1,
    id: 'com.atproto.handle.resolve',
    defs: {
      main: {
        type: 'query',
        description: 'Provides the DID of a repo.',
        parameters: {
          type: 'params',
          properties: {
            handle: {
              type: 'string',
              description:
                "The handle to resolve. If not supplied, will resolve the host's own handle.",
            },
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
                format: 'did',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoHandleUpdate: {
    lexicon: 1,
    id: 'com.atproto.handle.update',
    defs: {
      main: {
        type: 'procedure',
        description: 'Updates the handle of the account',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['handle'],
            properties: {
              handle: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoRepoBatchWrite: {
    lexicon: 1,
    id: 'com.atproto.repo.batchWrite',
    defs: {
      main: {
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
                format: 'did',
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
                  type: 'union',
                  refs: [
                    'lex:com.atproto.repo.batchWrite#create',
                    'lex:com.atproto.repo.batchWrite#update',
                    'lex:com.atproto.repo.batchWrite#delete',
                  ],
                  closed: true,
                },
              },
            },
          },
        },
      },
      create: {
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
          value: {
            type: 'unknown',
          },
        },
      },
      update: {
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
          value: {
            type: 'unknown',
          },
        },
      },
      delete: {
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
    },
  },
  ComAtprotoRepoCreateRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.createRecord',
    defs: {
      main: {
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
                format: 'did',
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
                type: 'unknown',
                description: 'The record to create.',
              },
            },
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
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoRepoDeleteRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.deleteRecord',
    defs: {
      main: {
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
                format: 'did',
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
          },
        },
      },
    },
  },
  ComAtprotoRepoDescribe: {
    lexicon: 1,
    id: 'com.atproto.repo.describe',
    defs: {
      main: {
        type: 'query',
        description:
          'Get information about the repo, including the list of collections.',
        parameters: {
          type: 'params',
          required: ['repo'],
          properties: {
            repo: {
              type: 'string',
              description: 'The handle or DID of the repo.',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'handle',
              'did',
              'didDoc',
              'collections',
              'handleIsCorrect',
            ],
            properties: {
              handle: {
                type: 'string',
              },
              did: {
                type: 'string',
                format: 'did',
              },
              didDoc: {
                type: 'unknown',
              },
              collections: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
              handleIsCorrect: {
                type: 'boolean',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoRepoGetRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.getRecord',
    defs: {
      main: {
        type: 'query',
        description: 'Fetch a record.',
        parameters: {
          type: 'params',
          required: ['repo', 'collection', 'rkey'],
          properties: {
            repo: {
              type: 'string',
              description: 'The handle or DID of the repo.',
            },
            collection: {
              type: 'string',
              description: 'The NSID of the collection.',
            },
            rkey: {
              type: 'string',
              description: 'The key of the record.',
            },
            cid: {
              type: 'string',
              format: 'cid',
              description:
                'The CID of the version of the record. If not specified, then return the most recent version.',
            },
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
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              value: {
                type: 'unknown',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoRepoListRecords: {
    lexicon: 1,
    id: 'com.atproto.repo.listRecords',
    defs: {
      main: {
        type: 'query',
        description: 'List a range of records in a collection.',
        parameters: {
          type: 'params',
          required: ['repo', 'collection'],
          properties: {
            repo: {
              type: 'string',
              description: 'The handle or DID of the repo.',
            },
            collection: {
              type: 'string',
              description: 'The NSID of the record type.',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
              description: 'The number of records to return.',
            },
            rkeyStart: {
              type: 'string',
              description:
                'The lowest sort-ordered rkey to start from (exclusive)',
            },
            rkeyEnd: {
              type: 'string',
              description:
                'The highest sort-ordered rkey to stop at (exclusive)',
            },
            reverse: {
              type: 'boolean',
              description: 'Reverse the order of the returned records?',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['records'],
            properties: {
              cursor: {
                type: 'string',
              },
              records: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.repo.listRecords#record',
                },
              },
            },
          },
        },
      },
      record: {
        type: 'object',
        required: ['uri', 'cid', 'value'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          value: {
            type: 'unknown',
          },
        },
      },
    },
  },
  ComAtprotoRepoPutRecord: {
    lexicon: 1,
    id: 'com.atproto.repo.putRecord',
    defs: {
      main: {
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
                format: 'did',
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
                type: 'unknown',
                description: 'The record to create.',
              },
            },
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
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoRepoRecordRef: {
    lexicon: 1,
    id: 'com.atproto.repo.recordRef',
    description: 'A URI with optional content-hash fingerprint.',
    defs: {
      main: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
        },
      },
    },
  },
  ComAtprotoRepoRepoRef: {
    lexicon: 1,
    id: 'com.atproto.repo.repoRef',
    description: 'A did identifying a repository.',
    defs: {
      main: {
        type: 'object',
        required: ['did'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
        },
      },
    },
  },
  ComAtprotoRepoStrongRef: {
    lexicon: 1,
    id: 'com.atproto.repo.strongRef',
    description: 'A URI with a content-hash fingerprint.',
    defs: {
      main: {
        type: 'object',
        required: ['uri', 'cid'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
        },
      },
    },
  },
  ComAtprotoReportCreate: {
    lexicon: 1,
    id: 'com.atproto.report.create',
    defs: {
      main: {
        type: 'procedure',
        description: 'Report a repo or a record.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['reasonType', 'subject'],
            properties: {
              reasonType: {
                type: 'ref',
                ref: 'lex:com.atproto.report.reasonType',
              },
              reason: {
                type: 'string',
              },
              subject: {
                type: 'union',
                refs: [
                  'lex:com.atproto.repo.repoRef',
                  'lex:com.atproto.repo.recordRef',
                ],
              },
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: [
              'id',
              'reasonType',
              'subject',
              'reportedBy',
              'createdAt',
            ],
            properties: {
              id: {
                type: 'integer',
              },
              reasonType: {
                type: 'ref',
                ref: 'lex:com.atproto.report.reasonType',
              },
              reason: {
                type: 'string',
              },
              subject: {
                type: 'union',
                refs: [
                  'lex:com.atproto.repo.repoRef',
                  'lex:com.atproto.repo.strongRef',
                ],
              },
              reportedBy: {
                type: 'string',
                format: 'did',
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
  },
  ComAtprotoReportReasonType: {
    lexicon: 1,
    id: 'com.atproto.report.reasonType',
    defs: {
      main: {
        type: 'string',
        knownValues: [
          'com.atproto.report.reasonType#spam',
          'com.atproto.report.reasonType#other',
        ],
      },
      spam: {
        type: 'token',
        description: 'Moderation report reason: Spam.',
      },
      other: {
        type: 'token',
        description: 'Moderation report reason: Other.',
      },
    },
  },
  ComAtprotoServerGetAccountsConfig: {
    lexicon: 1,
    id: 'com.atproto.server.getAccountsConfig',
    defs: {
      main: {
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
              links: {
                type: 'ref',
                ref: 'lex:com.atproto.server.getAccountsConfig#links',
              },
            },
          },
        },
      },
      links: {
        type: 'object',
        properties: {
          privacyPolicy: {
            type: 'string',
          },
          termsOfService: {
            type: 'string',
          },
        },
      },
    },
  },
  ComAtprotoSessionCreate: {
    lexicon: 1,
    id: 'com.atproto.session.create',
    defs: {
      main: {
        type: 'procedure',
        description: 'Create an authentication session.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['password'],
            properties: {
              identifier: {
                type: 'string',
                description:
                  'Handle or other identifier supported by the server for the authenticating user.',
              },
              password: {
                type: 'string',
              },
            },
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
                format: 'did',
              },
            },
          },
        },
        errors: [
          {
            name: 'AccountTakedown',
          },
        ],
      },
    },
  },
  ComAtprotoSessionDelete: {
    lexicon: 1,
    id: 'com.atproto.session.delete',
    defs: {
      main: {
        type: 'procedure',
        description: 'Delete the current session.',
      },
    },
  },
  ComAtprotoSessionGet: {
    lexicon: 1,
    id: 'com.atproto.session.get',
    defs: {
      main: {
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
                format: 'did',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSessionRefresh: {
    lexicon: 1,
    id: 'com.atproto.session.refresh',
    defs: {
      main: {
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
                format: 'did',
              },
            },
          },
        },
        errors: [
          {
            name: 'AccountTakedown',
          },
        ],
      },
    },
  },
  ComAtprotoSyncGetBlob: {
    lexicon: 1,
    id: 'com.atproto.sync.getBlob',
    defs: {
      main: {
        type: 'query',
        description: 'Get a blob associated with a given repo.',
        parameters: {
          type: 'params',
          required: ['did', 'cid'],
          properties: {
            did: {
              type: 'string',
              description: 'The DID of the repo.',
            },
            cid: {
              type: 'string',
              description: 'The CID of the blob to fetch',
            },
          },
        },
        output: {
          encoding: '*/*',
        },
      },
    },
  },
  ComAtprotoSyncGetBlocks: {
    lexicon: 1,
    id: 'com.atproto.sync.getBlocks',
    defs: {
      main: {
        type: 'query',
        description: 'Gets blocks from a given repo.',
        parameters: {
          type: 'params',
          required: ['did', 'cids'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            cids: {
              type: 'array',
              items: {
                type: 'string',
                format: 'cid',
              },
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncGetCheckout: {
    lexicon: 1,
    id: 'com.atproto.sync.getCheckout',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the repo state.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            commit: {
              type: 'string',
              format: 'cid',
              description:
                'The commit to get the checkout from. Defaults to current HEAD.',
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncGetCommitPath: {
    lexicon: 1,
    id: 'com.atproto.sync.getCommitPath',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the path of repo commits',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            latest: {
              type: 'string',
              format: 'cid',
              description: 'The most recent commit',
            },
            earliest: {
              type: 'string',
              format: 'cid',
              description: 'The earliest commit to start from',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['commits'],
            properties: {
              commits: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'cid',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncGetHead: {
    lexicon: 1,
    id: 'com.atproto.sync.getHead',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the current HEAD CID of a repo.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
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
                format: 'cid',
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncGetRecord: {
    lexicon: 1,
    id: 'com.atproto.sync.getRecord',
    defs: {
      main: {
        type: 'query',
        description:
          'Gets blocks needed for existence or non-existence of record.',
        parameters: {
          type: 'params',
          required: ['did', 'collection', 'rkey'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            collection: {
              type: 'string',
            },
            rkey: {
              type: 'string',
            },
            commit: {
              type: 'string',
              format: 'cid',
              description: 'An optional past commit CID.',
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncGetRepo: {
    lexicon: 1,
    id: 'com.atproto.sync.getRepo',
    defs: {
      main: {
        type: 'query',
        description: 'Gets the repo state.',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              format: 'did',
              description: 'The DID of the repo.',
            },
            earliest: {
              type: 'string',
              format: 'cid',
              description:
                'The earliest commit in the commit range (not inclusive)',
            },
            latest: {
              type: 'string',
              format: 'cid',
              description:
                'The latest commit you in the commit range (inclusive',
            },
          },
        },
        output: {
          encoding: 'application/vnd.ipld.car',
        },
      },
    },
  },
  ComAtprotoSyncListBlobs: {
    lexicon: 1,
    id: 'com.atproto.sync.listBlobs',
    defs: {
      main: {
        type: 'query',
        description: 'List blob cids for some range of commits',
        parameters: {
          type: 'params',
          required: ['did'],
          properties: {
            did: {
              type: 'string',
              description: 'The DID of the repo.',
            },
            latest: {
              type: 'string',
              description: 'The most recent commit',
            },
            earliest: {
              type: 'string',
              description: 'The earliest commit to start from',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['cids'],
            properties: {
              cids: {
                type: 'array',
                items: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncNotifyOfUpdate: {
    lexicon: 1,
    id: 'com.atproto.sync.notifyOfUpdate',
    defs: {
      main: {
        type: 'query',
        description:
          'Notify a crawling service of a recent update. Often when a long break between updates causes the connection with the crawling service to break.',
        parameters: {
          type: 'params',
          required: ['hostname'],
          properties: {
            hostname: {
              type: 'string',
              description:
                'Hostname of the service that is notifying of update.',
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncRequestCrawl: {
    lexicon: 1,
    id: 'com.atproto.sync.requestCrawl',
    defs: {
      main: {
        type: 'query',
        description: 'Request a service to persistently crawl hosted repos.',
        parameters: {
          type: 'params',
          required: ['hostname'],
          properties: {
            hostname: {
              type: 'string',
              description:
                'Hostname of the service that is requesting to be crawled.',
            },
          },
        },
      },
    },
  },
  ComAtprotoSyncSubscribeAllRepos: {
    lexicon: 1,
    id: 'com.atproto.sync.subscribeAllRepos',
    defs: {
      main: {
        type: 'subscription',
        description: 'Subscribe to repo updates',
        parameters: {
          type: 'params',
          properties: {
            cursor: {
              type: 'integer',
              description: 'The last known event to backfill from.',
            },
          },
        },
        message: {
          schema: {
            type: 'object',
            required: [
              'seq',
              'event',
              'repo',
              'commit',
              'prev',
              'blocks',
              'ops',
              'blobs',
              'time',
            ],
            nullable: ['prev'],
            properties: {
              seq: {
                type: 'integer',
              },
              event: {
                type: 'string',
                knownValues: ['repo_append', 'rebase'],
              },
              repo: {
                type: 'string',
                format: 'did',
              },
              commit: {
                type: 'string',
                format: 'cid',
              },
              prev: {
                type: 'string',
                format: 'cid',
              },
              blocks: {
                type: 'unknown',
              },
              ops: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.sync.subscribeAllRepos#repoOp',
                },
              },
              blobs: {
                type: 'array',
                items: {
                  type: 'string',
                  format: 'cid',
                },
              },
              time: {
                type: 'string',
                format: 'datetime',
              },
            },
          },
        },
        infos: [
          {
            name: 'OutdatedCursor',
          },
        ],
        errors: [
          {
            name: 'FutureCursor',
          },
        ],
      },
      repoOp: {
        type: 'object',
        required: ['action', 'path', 'cid'],
        nullable: ['cid'],
        properties: {
          action: {
            type: 'string',
            knownValues: ['create', 'update', 'delete'],
          },
          path: {
            type: 'string',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
        },
      },
    },
  },
  AppBskyActorGetProfile: {
    lexicon: 1,
    id: 'app.bsky.actor.getProfile',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.profile#view',
          },
        },
      },
    },
  },
  AppBskyActorGetProfiles: {
    lexicon: 1,
    id: 'app.bsky.actor.getProfiles',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['actors'],
          properties: {
            actors: {
              type: 'array',
              items: {
                type: 'string',
              },
              maxLength: 25,
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['profiles'],
            properties: {
              profiles: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.profile#view',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorGetSuggestions: {
    lexicon: 1,
    id: 'app.bsky.actor.getSuggestions',
    defs: {
      main: {
        type: 'query',
        description:
          'Get a list of actors suggested for following. Used in discovery UIs.',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['actors'],
            properties: {
              cursor: {
                type: 'string',
              },
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.profile#viewBasic',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorProfile: {
    lexicon: 1,
    id: 'app.bsky.actor.profile',
    defs: {
      main: {
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
            avatar: {
              type: 'image',
              accept: ['image/png', 'image/jpeg'],
              maxWidth: 2000,
              maxHeight: 2000,
              maxSize: 1000000,
            },
            banner: {
              type: 'image',
              accept: ['image/png', 'image/jpeg'],
              maxWidth: 6000,
              maxHeight: 2000,
              maxSize: 1000000,
            },
          },
        },
      },
      view: {
        type: 'object',
        required: [
          'did',
          'handle',
          'creator',
          'followersCount',
          'followsCount',
          'postsCount',
        ],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
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
          avatar: {
            type: 'string',
          },
          banner: {
            type: 'string',
          },
          followersCount: {
            type: 'integer',
          },
          followsCount: {
            type: 'integer',
          },
          postsCount: {
            type: 'integer',
          },
          creator: {
            type: 'string',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.profile#viewerState',
          },
          myState: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.profile#myState',
            description: 'Deprecated',
          },
        },
      },
      viewBasic: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
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
          avatar: {
            type: 'string',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.profile#viewerState',
          },
        },
      },
      viewerState: {
        type: 'object',
        properties: {
          muted: {
            type: 'boolean',
          },
          following: {
            type: 'string',
            format: 'at-uri',
          },
          followedBy: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
      myState: {
        type: 'object',
        description: 'Deprecated in favor of #viewerState',
        properties: {
          follow: {
            type: 'string',
            format: 'at-uri',
          },
          muted: {
            type: 'boolean',
          },
        },
      },
    },
  },
  AppBskyActorRef: {
    lexicon: 1,
    id: 'app.bsky.actor.ref',
    description: 'A reference to an actor in the network.',
    defs: {
      withInfo: {
        type: 'object',
        required: ['did', 'handle'],
        properties: {
          did: {
            type: 'string',
            format: 'did',
          },
          handle: {
            type: 'string',
          },
          displayName: {
            type: 'string',
            maxLength: 64,
          },
          avatar: {
            type: 'string',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.ref#viewerState',
          },
        },
      },
      viewerState: {
        type: 'object',
        properties: {
          muted: {
            type: 'boolean',
          },
          following: {
            type: 'string',
            format: 'at-uri',
          },
          followedBy: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
    },
  },
  AppBskyActorSearch: {
    lexicon: 1,
    id: 'app.bsky.actor.search',
    defs: {
      main: {
        type: 'query',
        description: 'Find actors matching search criteria.',
        parameters: {
          type: 'params',
          properties: {
            term: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['actors'],
            properties: {
              cursor: {
                type: 'string',
              },
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.profile#viewBasic',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorSearchTypeahead: {
    lexicon: 1,
    id: 'app.bsky.actor.searchTypeahead',
    defs: {
      main: {
        type: 'query',
        description: 'Find actor suggestions for a search term.',
        parameters: {
          type: 'params',
          properties: {
            term: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actors'],
            properties: {
              actors: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.ref#withInfo',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyActorUpdateProfile: {
    lexicon: 1,
    id: 'app.bsky.actor.updateProfile',
    defs: {
      main: {
        type: 'procedure',
        description: "Update an actor's profile.",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            nullable: ['description', 'avatar', 'banner'],
            properties: {
              displayName: {
                type: 'string',
                maxLength: 64,
              },
              description: {
                type: 'string',
                maxLength: 256,
              },
              avatar: {
                type: 'image',
                accept: ['image/png', 'image/jpeg'],
                maxWidth: 500,
                maxHeight: 500,
                maxSize: 100000,
              },
              banner: {
                type: 'image',
                accept: ['image/png', 'image/jpeg'],
                maxWidth: 1500,
                maxHeight: 500,
                maxSize: 500000,
              },
            },
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
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              record: {
                type: 'unknown',
              },
            },
          },
        },
        errors: [
          {
            name: 'InvalidBlob',
          },
          {
            name: 'BlobTooLarge',
          },
          {
            name: 'InvalidMimeType',
          },
          {
            name: 'InvalidImageDimensions',
          },
        ],
      },
    },
  },
  AppBskyEmbedExternal: {
    lexicon: 1,
    id: 'app.bsky.embed.external',
    description:
      'An representation of some externally linked content, embedded in another form of content',
    defs: {
      main: {
        type: 'object',
        required: ['external'],
        properties: {
          external: {
            type: 'ref',
            ref: 'lex:app.bsky.embed.external#external',
          },
        },
      },
      external: {
        type: 'object',
        required: ['uri', 'title', 'description'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          thumb: {
            type: 'image',
            accept: ['image/*'],
            maxWidth: 2000,
            maxHeight: 2000,
            maxSize: 1000000,
          },
        },
      },
      presented: {
        type: 'object',
        required: ['external'],
        properties: {
          external: {
            type: 'ref',
            ref: 'lex:app.bsky.embed.external#presentedExternal',
          },
        },
      },
      presentedExternal: {
        type: 'object',
        required: ['uri', 'title', 'description'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          title: {
            type: 'string',
          },
          description: {
            type: 'string',
          },
          thumb: {
            type: 'string',
          },
        },
      },
    },
  },
  AppBskyEmbedImages: {
    lexicon: 1,
    id: 'app.bsky.embed.images',
    description: 'A set of images embedded in some other form of content',
    defs: {
      main: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.bsky.embed.images#image',
            },
            maxLength: 4,
          },
        },
      },
      image: {
        type: 'object',
        required: ['image', 'alt'],
        properties: {
          image: {
            type: 'image',
            accept: ['image/*'],
            maxWidth: 2000,
            maxHeight: 2000,
            maxSize: 1000000,
          },
          alt: {
            type: 'string',
          },
        },
      },
      presented: {
        type: 'object',
        required: ['images'],
        properties: {
          images: {
            type: 'array',
            items: {
              type: 'ref',
              ref: 'lex:app.bsky.embed.images#presentedImage',
            },
            maxLength: 4,
          },
        },
      },
      presentedImage: {
        type: 'object',
        required: ['thumb', 'fullsize', 'alt'],
        properties: {
          thumb: {
            type: 'string',
          },
          fullsize: {
            type: 'string',
          },
          alt: {
            type: 'string',
          },
        },
      },
    },
  },
  AppBskyEmbedRecord: {
    lexicon: 1,
    id: 'app.bsky.embed.record',
    description:
      'An representation of a record embedded in another form of content',
    defs: {
      main: {
        type: 'object',
        required: ['record'],
        properties: {
          record: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
        },
      },
      presented: {
        type: 'object',
        required: ['record'],
        properties: {
          record: {
            type: 'union',
            refs: [
              'lex:app.bsky.embed.record#presentedRecord',
              'lex:app.bsky.embed.record#presentedNotFound',
            ],
          },
        },
      },
      presentedRecord: {
        type: 'object',
        required: ['uri', 'cid', 'author', 'record'],
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
            ref: 'lex:app.bsky.actor.ref#withInfo',
          },
          record: {
            type: 'unknown',
          },
        },
      },
      presentedNotFound: {
        type: 'object',
        required: ['uri'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
        },
      },
    },
  },
  AppBskyFeedFeedViewPost: {
    lexicon: 1,
    id: 'app.bsky.feed.feedViewPost',
    defs: {
      main: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.post#view',
          },
          reply: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.feedViewPost#replyRef',
          },
          reason: {
            type: 'union',
            refs: ['lex:app.bsky.feed.feedViewPost#reasonRepost'],
          },
        },
      },
      replyRef: {
        type: 'object',
        required: ['root', 'parent'],
        properties: {
          root: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.post#view',
          },
          parent: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.post#view',
          },
        },
      },
      reasonRepost: {
        type: 'object',
        required: ['by', 'indexedAt'],
        properties: {
          by: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.ref#withInfo',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  AppBskyFeedGetAuthorFeed: {
    lexicon: 1,
    id: 'app.bsky.feed.getAuthorFeed',
    defs: {
      main: {
        type: 'query',
        description: "A view of an actor's feed.",
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
                  ref: 'lex:app.bsky.feed.feedViewPost',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetPostThread: {
    lexicon: 1,
    id: 'app.bsky.feed.getPostThread',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            depth: {
              type: 'integer',
            },
          },
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['thread'],
            properties: {
              thread: {
                type: 'union',
                refs: [
                  'lex:app.bsky.feed.getPostThread#threadViewPost',
                  'lex:app.bsky.feed.getPostThread#notFoundPost',
                ],
              },
            },
          },
        },
        errors: [
          {
            name: 'NotFound',
          },
        ],
      },
      threadViewPost: {
        type: 'object',
        required: ['post'],
        properties: {
          post: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.post#view',
          },
          parent: {
            type: 'union',
            refs: [
              'lex:app.bsky.feed.getPostThread#threadViewPost',
              'lex:app.bsky.feed.getPostThread#notFoundPost',
            ],
          },
          replies: {
            type: 'array',
            items: {
              type: 'union',
              refs: [
                'lex:app.bsky.feed.getPostThread#threadViewPost',
                'lex:app.bsky.feed.getPostThread#notFoundPost',
              ],
            },
          },
        },
      },
      notFoundPost: {
        type: 'object',
        required: ['uri', 'notFound'],
        properties: {
          uri: {
            type: 'string',
            format: 'at-uri',
          },
          notFound: {
            type: 'boolean',
            const: true,
          },
        },
      },
    },
  },
  AppBskyFeedGetRepostedBy: {
    lexicon: 1,
    id: 'app.bsky.feed.getRepostedBy',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            cid: {
              type: 'string',
              format: 'cid',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['uri', 'repostedBy'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              cursor: {
                type: 'string',
              },
              repostedBy: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.ref#withInfo',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetTimeline: {
    lexicon: 1,
    id: 'app.bsky.feed.getTimeline',
    defs: {
      main: {
        type: 'query',
        description: "A view of the user's home timeline.",
        parameters: {
          type: 'params',
          properties: {
            algorithm: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
                  ref: 'lex:app.bsky.feed.feedViewPost',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedGetVotes: {
    lexicon: 1,
    id: 'app.bsky.feed.getVotes',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['uri'],
          properties: {
            uri: {
              type: 'string',
              format: 'at-uri',
            },
            cid: {
              type: 'string',
              format: 'cid',
            },
            direction: {
              type: 'string',
              enum: ['up', 'down'],
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['uri', 'votes'],
            properties: {
              uri: {
                type: 'string',
                format: 'at-uri',
              },
              cid: {
                type: 'string',
                format: 'cid',
              },
              cursor: {
                type: 'string',
              },
              votes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.feed.getVotes#vote',
                },
              },
            },
          },
        },
      },
      vote: {
        type: 'object',
        required: ['direction', 'indexedAt', 'createdAt', 'actor'],
        properties: {
          direction: {
            type: 'string',
            enum: ['up', 'down'],
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          createdAt: {
            type: 'string',
            format: 'datetime',
          },
          actor: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.ref#withInfo',
          },
        },
      },
    },
  },
  AppBskyFeedPost: {
    lexicon: 1,
    id: 'app.bsky.feed.post',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['text', 'createdAt'],
          properties: {
            text: {
              type: 'string',
              maxLength: 300,
              maxUtf8: 3000,
            },
            entities: {
              type: 'array',
              items: {
                type: 'ref',
                ref: 'lex:app.bsky.feed.post#entity',
              },
            },
            reply: {
              type: 'ref',
              ref: 'lex:app.bsky.feed.post#replyRef',
            },
            embed: {
              type: 'union',
              refs: [
                'lex:app.bsky.embed.images',
                'lex:app.bsky.embed.external',
                'lex:app.bsky.embed.record',
              ],
            },
            createdAt: {
              type: 'string',
              format: 'datetime',
            },
          },
        },
      },
      replyRef: {
        type: 'object',
        required: ['root', 'parent'],
        properties: {
          root: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
          parent: {
            type: 'ref',
            ref: 'lex:com.atproto.repo.strongRef',
          },
        },
      },
      entity: {
        type: 'object',
        required: ['index', 'type', 'value'],
        properties: {
          index: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.post#textSlice',
          },
          type: {
            type: 'string',
            description:
              "Expected values are 'mention', 'hashtag', and 'link'.",
          },
          value: {
            type: 'string',
          },
        },
      },
      textSlice: {
        type: 'object',
        description: 'A text segment. Start is inclusive, end is exclusive.',
        required: ['start', 'end'],
        properties: {
          start: {
            type: 'integer',
            minimum: 0,
          },
          end: {
            type: 'integer',
            minimum: 0,
          },
        },
      },
      view: {
        type: 'object',
        required: [
          'uri',
          'cid',
          'author',
          'record',
          'replyCount',
          'repostCount',
          'upvoteCount',
          'downvoteCount',
          'indexedAt',
          'viewer',
        ],
        properties: {
          uri: {
            type: 'string',
          },
          cid: {
            type: 'string',
          },
          author: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.ref#withInfo',
          },
          record: {
            type: 'unknown',
          },
          embed: {
            type: 'union',
            refs: [
              'lex:app.bsky.embed.images#presented',
              'lex:app.bsky.embed.external#presented',
              'lex:app.bsky.embed.record#presented',
            ],
          },
          replyCount: {
            type: 'integer',
          },
          repostCount: {
            type: 'integer',
          },
          upvoteCount: {
            type: 'integer',
          },
          downvoteCount: {
            type: 'integer',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
          viewer: {
            type: 'ref',
            ref: 'lex:app.bsky.feed.post#viewerState',
          },
        },
      },
      viewerState: {
        type: 'object',
        properties: {
          repost: {
            type: 'string',
          },
          upvote: {
            type: 'string',
          },
          downvote: {
            type: 'string',
          },
        },
      },
    },
  },
  AppBskyFeedRepost: {
    lexicon: 1,
    id: 'app.bsky.feed.repost',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
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
  AppBskyFeedSetVote: {
    lexicon: 1,
    id: 'app.bsky.feed.setVote',
    defs: {
      main: {
        type: 'procedure',
        description: "Upvote, downvote, or clear the user's vote for a post.",
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['subject', 'direction'],
            properties: {
              subject: {
                type: 'ref',
                ref: 'lex:com.atproto.repo.strongRef',
              },
              direction: {
                type: 'string',
                enum: ['up', 'down', 'none'],
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
                format: 'at-uri',
              },
              downvote: {
                type: 'string',
                format: 'at-uri',
              },
            },
          },
        },
      },
    },
  },
  AppBskyFeedVote: {
    lexicon: 1,
    id: 'app.bsky.feed.vote',
    defs: {
      main: {
        type: 'record',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'direction', 'createdAt'],
          properties: {
            subject: {
              type: 'ref',
              ref: 'lex:com.atproto.repo.strongRef',
            },
            direction: {
              type: 'string',
              enum: ['up', 'down'],
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
  AppBskyGraphAssertCreator: {
    lexicon: 1,
    id: 'app.bsky.graph.assertCreator',
    defs: {
      main: {
        type: 'token',
        description:
          "Assertion type: Creator. Defined for app.bsky.graph.assertions's assertion.",
      },
    },
  },
  AppBskyGraphAssertMember: {
    lexicon: 1,
    id: 'app.bsky.graph.assertMember',
    defs: {
      main: {
        type: 'token',
        description:
          "Assertion type: Member. Defined for app.bsky.graph.assertions's assertion.",
      },
    },
  },
  AppBskyGraphFollow: {
    lexicon: 1,
    id: 'app.bsky.graph.follow',
    defs: {
      main: {
        type: 'record',
        description: 'A social follow.',
        key: 'tid',
        record: {
          type: 'object',
          required: ['subject', 'createdAt'],
          properties: {
            subject: {
              type: 'string',
              format: 'did',
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
  AppBskyGraphGetFollowers: {
    lexicon: 1,
    id: 'app.bsky.graph.getFollowers',
    defs: {
      main: {
        type: 'query',
        description: 'Who is following an actor?',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['subject', 'followers'],
            properties: {
              subject: {
                type: 'ref',
                ref: 'lex:app.bsky.actor.ref#withInfo',
              },
              cursor: {
                type: 'string',
              },
              followers: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.ref#withInfo',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetFollows: {
    lexicon: 1,
    id: 'app.bsky.graph.getFollows',
    defs: {
      main: {
        type: 'query',
        description: 'Who is an actor following?',
        parameters: {
          type: 'params',
          required: ['actor'],
          properties: {
            actor: {
              type: 'string',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['subject', 'follows'],
            properties: {
              subject: {
                type: 'ref',
                ref: 'lex:app.bsky.actor.ref#withInfo',
              },
              cursor: {
                type: 'string',
              },
              follows: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.ref#withInfo',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphGetMutes: {
    lexicon: 1,
    id: 'app.bsky.graph.getMutes',
    defs: {
      main: {
        type: 'query',
        description: 'Who does the viewer mute?',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['mutes'],
            properties: {
              cursor: {
                type: 'string',
              },
              mutes: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.actor.ref#withInfo',
                },
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphMute: {
    lexicon: 1,
    id: 'app.bsky.graph.mute',
    defs: {
      main: {
        type: 'procedure',
        description: 'Mute an actor by did or handle.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actor'],
            properties: {
              actor: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  AppBskyGraphUnmute: {
    lexicon: 1,
    id: 'app.bsky.graph.unmute',
    defs: {
      main: {
        type: 'procedure',
        description: 'Unmute an actor by did or handle.',
        input: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['actor'],
            properties: {
              actor: {
                type: 'string',
              },
            },
          },
        },
      },
    },
  },
  AppBskyNotificationGetCount: {
    lexicon: 1,
    id: 'app.bsky.notification.getCount',
    defs: {
      main: {
        type: 'query',
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['count'],
            properties: {
              count: {
                type: 'integer',
              },
            },
          },
        },
      },
    },
  },
  AppBskyNotificationList: {
    lexicon: 1,
    id: 'app.bsky.notification.list',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          properties: {
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
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
            required: ['notifications'],
            properties: {
              cursor: {
                type: 'string',
              },
              notifications: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:app.bsky.notification.list#notification',
                },
              },
            },
          },
        },
      },
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
            format: 'at-uri',
          },
          cid: {
            type: 'string',
            format: 'cid',
          },
          author: {
            type: 'ref',
            ref: 'lex:app.bsky.actor.ref#withInfo',
          },
          reason: {
            type: 'string',
            description:
              "Expected values are 'vote', 'repost', 'follow', 'invite', 'mention' and 'reply'.",
            knownValues: [
              'vote',
              'repost',
              'follow',
              'invite',
              'mention',
              'reply',
            ],
          },
          reasonSubject: {
            type: 'string',
            format: 'at-uri',
          },
          record: {
            type: 'unknown',
          },
          isRead: {
            type: 'boolean',
          },
          indexedAt: {
            type: 'string',
            format: 'datetime',
          },
        },
      },
    },
  },
  AppBskyNotificationUpdateSeen: {
    lexicon: 1,
    id: 'app.bsky.notification.updateSeen',
    defs: {
      main: {
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
                format: 'datetime',
              },
            },
          },
        },
      },
    },
  },
}
export const schemas: LexiconDoc[] = Object.values(schemaDict) as LexiconDoc[]
export const lexicons: Lexicons = new Lexicons(schemas)
export const ids = {
  ComAtprotoAccountCreate: 'com.atproto.account.create',
  ComAtprotoAccountCreateInviteCode: 'com.atproto.account.createInviteCode',
  ComAtprotoAccountDelete: 'com.atproto.account.delete',
  ComAtprotoAccountGet: 'com.atproto.account.get',
  ComAtprotoAccountRequestDelete: 'com.atproto.account.requestDelete',
  ComAtprotoAccountRequestPasswordReset:
    'com.atproto.account.requestPasswordReset',
  ComAtprotoAccountResetPassword: 'com.atproto.account.resetPassword',
  ComAtprotoAdminBlob: 'com.atproto.admin.blob',
  ComAtprotoAdminGetModerationAction: 'com.atproto.admin.getModerationAction',
  ComAtprotoAdminGetModerationActions: 'com.atproto.admin.getModerationActions',
  ComAtprotoAdminGetModerationReport: 'com.atproto.admin.getModerationReport',
  ComAtprotoAdminGetModerationReports: 'com.atproto.admin.getModerationReports',
  ComAtprotoAdminGetRecord: 'com.atproto.admin.getRecord',
  ComAtprotoAdminGetRepo: 'com.atproto.admin.getRepo',
  ComAtprotoAdminModerationAction: 'com.atproto.admin.moderationAction',
  ComAtprotoAdminModerationReport: 'com.atproto.admin.moderationReport',
  ComAtprotoAdminRecord: 'com.atproto.admin.record',
  ComAtprotoAdminRepo: 'com.atproto.admin.repo',
  ComAtprotoAdminResolveModerationReports:
    'com.atproto.admin.resolveModerationReports',
  ComAtprotoAdminReverseModerationAction:
    'com.atproto.admin.reverseModerationAction',
  ComAtprotoAdminSearchRepos: 'com.atproto.admin.searchRepos',
  ComAtprotoAdminTakeModerationAction: 'com.atproto.admin.takeModerationAction',
  ComAtprotoBlobUpload: 'com.atproto.blob.upload',
  ComAtprotoHandleResolve: 'com.atproto.handle.resolve',
  ComAtprotoHandleUpdate: 'com.atproto.handle.update',
  ComAtprotoRepoBatchWrite: 'com.atproto.repo.batchWrite',
  ComAtprotoRepoCreateRecord: 'com.atproto.repo.createRecord',
  ComAtprotoRepoDeleteRecord: 'com.atproto.repo.deleteRecord',
  ComAtprotoRepoDescribe: 'com.atproto.repo.describe',
  ComAtprotoRepoGetRecord: 'com.atproto.repo.getRecord',
  ComAtprotoRepoListRecords: 'com.atproto.repo.listRecords',
  ComAtprotoRepoPutRecord: 'com.atproto.repo.putRecord',
  ComAtprotoRepoRecordRef: 'com.atproto.repo.recordRef',
  ComAtprotoRepoRepoRef: 'com.atproto.repo.repoRef',
  ComAtprotoRepoStrongRef: 'com.atproto.repo.strongRef',
  ComAtprotoReportCreate: 'com.atproto.report.create',
  ComAtprotoReportReasonType: 'com.atproto.report.reasonType',
  ComAtprotoServerGetAccountsConfig: 'com.atproto.server.getAccountsConfig',
  ComAtprotoSessionCreate: 'com.atproto.session.create',
  ComAtprotoSessionDelete: 'com.atproto.session.delete',
  ComAtprotoSessionGet: 'com.atproto.session.get',
  ComAtprotoSessionRefresh: 'com.atproto.session.refresh',
  ComAtprotoSyncGetBlob: 'com.atproto.sync.getBlob',
  ComAtprotoSyncGetBlocks: 'com.atproto.sync.getBlocks',
  ComAtprotoSyncGetCheckout: 'com.atproto.sync.getCheckout',
  ComAtprotoSyncGetCommitPath: 'com.atproto.sync.getCommitPath',
  ComAtprotoSyncGetHead: 'com.atproto.sync.getHead',
  ComAtprotoSyncGetRecord: 'com.atproto.sync.getRecord',
  ComAtprotoSyncGetRepo: 'com.atproto.sync.getRepo',
  ComAtprotoSyncListBlobs: 'com.atproto.sync.listBlobs',
  ComAtprotoSyncNotifyOfUpdate: 'com.atproto.sync.notifyOfUpdate',
  ComAtprotoSyncRequestCrawl: 'com.atproto.sync.requestCrawl',
  ComAtprotoSyncSubscribeAllRepos: 'com.atproto.sync.subscribeAllRepos',
  AppBskyActorGetProfile: 'app.bsky.actor.getProfile',
  AppBskyActorGetProfiles: 'app.bsky.actor.getProfiles',
  AppBskyActorGetSuggestions: 'app.bsky.actor.getSuggestions',
  AppBskyActorProfile: 'app.bsky.actor.profile',
  AppBskyActorRef: 'app.bsky.actor.ref',
  AppBskyActorSearch: 'app.bsky.actor.search',
  AppBskyActorSearchTypeahead: 'app.bsky.actor.searchTypeahead',
  AppBskyActorUpdateProfile: 'app.bsky.actor.updateProfile',
  AppBskyEmbedExternal: 'app.bsky.embed.external',
  AppBskyEmbedImages: 'app.bsky.embed.images',
  AppBskyEmbedRecord: 'app.bsky.embed.record',
  AppBskyFeedFeedViewPost: 'app.bsky.feed.feedViewPost',
  AppBskyFeedGetAuthorFeed: 'app.bsky.feed.getAuthorFeed',
  AppBskyFeedGetPostThread: 'app.bsky.feed.getPostThread',
  AppBskyFeedGetRepostedBy: 'app.bsky.feed.getRepostedBy',
  AppBskyFeedGetTimeline: 'app.bsky.feed.getTimeline',
  AppBskyFeedGetVotes: 'app.bsky.feed.getVotes',
  AppBskyFeedPost: 'app.bsky.feed.post',
  AppBskyFeedRepost: 'app.bsky.feed.repost',
  AppBskyFeedSetVote: 'app.bsky.feed.setVote',
  AppBskyFeedVote: 'app.bsky.feed.vote',
  AppBskyGraphAssertCreator: 'app.bsky.graph.assertCreator',
  AppBskyGraphAssertMember: 'app.bsky.graph.assertMember',
  AppBskyGraphFollow: 'app.bsky.graph.follow',
  AppBskyGraphGetFollowers: 'app.bsky.graph.getFollowers',
  AppBskyGraphGetFollows: 'app.bsky.graph.getFollows',
  AppBskyGraphGetMutes: 'app.bsky.graph.getMutes',
  AppBskyGraphMute: 'app.bsky.graph.mute',
  AppBskyGraphUnmute: 'app.bsky.graph.unmute',
  AppBskyNotificationGetCount: 'app.bsky.notification.getCount',
  AppBskyNotificationList: 'app.bsky.notification.list',
  AppBskyNotificationUpdateSeen: 'app.bsky.notification.updateSeen',
}
