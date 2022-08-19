import { recordSchemas } from './schemas/defs'
import { AdxSchemas } from '@adxp/schemas'
import { Follow, Like, Post } from './types'

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

export const likeRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Like',
)
export const isLike = (obj: unknown): obj is Like.Record => {
  return postRecordValidator.isValid(obj)
}

export const followRecordValidator = s.createRecordValidator(
  'blueskyweb.xyz:Follow',
)
export const isFollow = (obj: unknown): obj is Follow.Record => {
  return postRecordValidator.isValid(obj)
}
