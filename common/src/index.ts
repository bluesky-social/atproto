export * from './blockstore/ipld-store.js'
export * from './blockstore/memory-blockstore.js'
export * from './blockstore/persistent-blockstore.js'
export * from './user-store/index.js'
export * from './user-store/tid.js'
export * as check from './common/check.js'
export * as service from './network/service.js'
export * as util from './common/util.js'
export * as ucanCheck from './auth/ucan-checks.js'
export * as microblog from './microblog/types.js'

import { schema as microblogSchema } from './microblog/types.js'
import { schema as commonSchema } from './common/types.js'
import { schema as repoSchema } from './user-store/types.js'

export const schema = {
  microblog: microblogSchema,
  common: commonSchema,
  repo: repoSchema,
}
