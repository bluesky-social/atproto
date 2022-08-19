import { recordSchemas } from './schemas/defs'
import { AdxSchemas } from '@adxp/schemas'
import { Post } from './types'

const s = new AdxSchemas()
for (const schema of recordSchemas) {
  s.add(schema)
}

export const postRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Post',
)
export const isPost = (obj: unknown): obj is Post.Record => {
  return postRecordValidator.isValid(obj)
}
