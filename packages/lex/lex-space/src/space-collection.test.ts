import { describe, expectTypeOf, it } from 'vitest'
import type { RecordSchema, Space } from '@atproto/lex-schema'
import type { SpaceCollection, SpaceRecordSchema } from './space-collection.js'

type Note = RecordSchema<'tid', 'com.example.note'>
type Task = RecordSchema<'tid', 'com.example.task'>
type Group = Space<'any', 'com.example.group', Note | Task>

describe('SpaceRecordSchema', () => {
  it('is the record schema of each collection of a space type', () => {
    expectTypeOf<SpaceCollection<Group>>().toEqualTypeOf<
      'com.example.note' | 'com.example.task'
    >()
    expectTypeOf<SpaceRecordSchema<Group>>().toEqualTypeOf<Note | Task>()
    expectTypeOf<
      SpaceRecordSchema<Group, 'com.example.note'>
    >().toEqualTypeOf<Note>()
    expectTypeOf<
      SpaceRecordSchema<Group, 'com.example.other'>
    >().toEqualTypeOf<never>()
  })

  it('is any record schema of an unknown space type', () => {
    expectTypeOf<
      SpaceRecordSchema<Space, 'com.example.note'>
    >().toEqualTypeOf<RecordSchema>()
  })
})
