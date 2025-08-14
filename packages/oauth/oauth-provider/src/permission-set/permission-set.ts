// @NOTE should this be moved to @atproto/lexicon ?

import { z } from 'zod'
import {
  Accept,
  REPO_ACTIONS,
  isAccept,
  isAudParam,
  isCollectionParam,
  isLxmParam,
} from '@atproto/oauth-scopes'

const RESOURCE = 'resource'

const permissionBaseSchema = z.object({ type: z.literal('permission') })

const acceptSchema = z.custom<Accept>(isAccept, {
  message: 'Invalid blob MIME type',
})
export const blobPermissionSchema = permissionBaseSchema.extend({
  [RESOURCE]: z.literal('blob'),
  accept: z.array(acceptSchema).nonempty(),
})
export type BlobPermission = z.infer<typeof blobPermissionSchema>

const collectionSchema = z
  .string()
  .refine(isCollectionParam, 'Invalid NSID or "*"')
export const repoPermissionSchema = permissionBaseSchema.extend({
  [RESOURCE]: z.literal('repo'),
  collection: z.array(collectionSchema).nonempty(),
  action: z.array(z.enum(REPO_ACTIONS)).nonempty(),
})
export type RepoPermission = z.infer<typeof repoPermissionSchema>

const audSchema = z.string().refine(isAudParam, 'Invalid DID or "*"')
const lxmSchema = z.string().refine(isLxmParam, 'Invalid NSID or "*"')
export const rpcPermissionSchema = permissionBaseSchema.extend({
  [RESOURCE]: z.literal('rpc'),
  aud: audSchema,
  lxm: z.array(lxmSchema).nonempty(),
})
export type RpcPermission = z.infer<typeof rpcPermissionSchema>

export const permissionSetSchema = z.object({
  type: z.literal('permission-set'),
  description: z.string().optional(),
  permissions: z
    .array(
      z.discriminatedUnion(RESOURCE, [
        blobPermissionSchema,
        repoPermissionSchema,
        rpcPermissionSchema,
      ]),
    )
    .nonempty(),
})

export type PermissionSet = z.infer<typeof permissionSetSchema>
