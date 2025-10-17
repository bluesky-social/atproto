import { Infer } from '../core.js'
import { lexParameterSchema } from './_parameters.js'
import { LexDict } from './dict.js'
import { LexIntersection } from './intersection.js'
import { LexLiteral } from './literal.js'
import { LexObject } from './object.js'
import { LexString } from './string.js'

export const lexiconPermission = new LexIntersection(
  new LexObject(
    {
      type: new LexLiteral('permission'),
      resource: new LexString({ minLength: 1 }),
    },
    { required: ['type', 'resource'] },
  ),
  new LexDict(new LexString({}), lexParameterSchema),
)

export type LexiconPermission = Infer<typeof lexiconPermission>
