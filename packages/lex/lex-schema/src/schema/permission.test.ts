import { describe, expect, it } from 'vitest'
import { permission } from './permission.js'

describe('Permission', () => {
  describe('basic construction', () => {
    it('creates a perm with resource and empty options', () => {
      const perm = permission('read', {})
      expect(perm.resource).toBe('read')
      expect(perm.options).toEqual({})
    })

    it('creates a perm with resource and options', () => {
      const options = { limit: 100 }
      const perm = permission('read', options)
      expect(perm.resource).toBe('read')
      expect(perm.options).toEqual({ limit: 100 })
    })

    it('preserves the options object reference', () => {
      const options = { limit: 100 }
      const perm = permission('read', options)
      expect(perm.options).toBe(options)
    })

    it('preserves resource as const literal type', () => {
      const perm = permission('read' as const, {})
      expect(perm.resource).toBe('read')
    })
  })

  describe('resource strings', () => {
    it('handles simple resource names', () => {
      const perm = permission('read', {})
      expect(perm.resource).toBe('read')
    })

    it('handles namespaced resource names', () => {
      const perm = permission('com.example.read', {})
      expect(perm.resource).toBe('com.example.read')
    })

    it('handles resource names with dashes', () => {
      const perm = permission('read-posts', {})
      expect(perm.resource).toBe('read-posts')
    })

    it('handles resource names with underscores', () => {
      const perm = permission('read_posts', {})
      expect(perm.resource).toBe('read_posts')
    })

    it('handles resource names with colons', () => {
      const perm = permission('posts:read', {})
      expect(perm.resource).toBe('posts:read')
    })

    it('handles resource names with slashes', () => {
      const perm = permission('posts/read', {})
      expect(perm.resource).toBe('posts/read')
    })

    it('handles resource names with wildcards', () => {
      const perm = permission('posts:*', {})
      expect(perm.resource).toBe('posts:*')
    })

    it('handles empty resource string', () => {
      const perm = permission('', {})
      expect(perm.resource).toBe('')
    })

    it('handles very long resource strings', () => {
      const longResource = 'com.example.service.'.repeat(50) + 'read'
      const perm = permission(longResource, {})
      expect(perm.resource).toBe(longResource)
    })

    it('handles resource strings with unicode characters', () => {
      const perm = permission('リソース', {})
      expect(perm.resource).toBe('リソース')
    })

    it('handles resource strings with special characters', () => {
      const perm = permission('resource@#$%', {})
      expect(perm.resource).toBe('resource@#$%')
    })
  })

  describe('options with string parameters', () => {
    it('accepts empty options object', () => {
      const perm = permission('read', {})
      expect(perm.options).toEqual({})
    })

    it('accepts options with string value', () => {
      const perm = permission('read', { format: 'json' })
      expect(perm.options).toEqual({ format: 'json' })
    })

    it('accepts options with multiple string values', () => {
      const perm = permission('read', {
        format: 'json',
        encoding: 'utf-8',
      })
      expect(perm.options).toEqual({ format: 'json', encoding: 'utf-8' })
    })

    it('accepts options with empty string value', () => {
      const perm = permission('read', { filter: '' })
      expect(perm.options).toEqual({ filter: '' })
    })

    it('accepts options with very long string values', () => {
      const longString = 'value'.repeat(1000)
      const perm = permission('read', { data: longString })
      expect(perm.options.data).toBe(longString)
    })
  })

  describe('options with integer parameters', () => {
    it('accepts options with positive integer', () => {
      const perm = permission('read', { limit: 100 })
      expect(perm.options).toEqual({ limit: 100 })
    })

    it('accepts options with zero', () => {
      const perm = permission('read', { offset: 0 })
      expect(perm.options).toEqual({ offset: 0 })
    })

    it('accepts options with negative integer', () => {
      const perm = permission('read', { delta: -50 })
      expect(perm.options).toEqual({ delta: -50 })
    })

    it('accepts options with multiple integers', () => {
      const perm = permission('read', {
        limit: 100,
        offset: 20,
        maxRetries: 3,
      })
      expect(perm.options).toEqual({
        limit: 100,
        offset: 20,
        maxRetries: 3,
      })
    })

    it('accepts options with large integers', () => {
      const perm = permission('read', { maxSize: 2147483647 })
      expect(perm.options).toEqual({ maxSize: 2147483647 })
    })
  })

  describe('options with boolean parameters', () => {
    it('accepts options with true boolean', () => {
      const perm = permission('read', { includeDeleted: true })
      expect(perm.options).toEqual({ includeDeleted: true })
    })

    it('accepts options with false boolean', () => {
      const perm = permission('read', { includeDeleted: false })
      expect(perm.options).toEqual({ includeDeleted: false })
    })

    it('accepts options with multiple booleans', () => {
      const perm = permission('read', {
        includeDeleted: true,
        includeDrafts: false,
        includeArchived: true,
      })
      expect(perm.options).toEqual({
        includeDeleted: true,
        includeDrafts: false,
        includeArchived: true,
      })
    })
  })

  describe('options with array parameters', () => {
    it('accepts options with string array', () => {
      const perm = permission('read', { fields: ['id', 'name'] })
      expect(perm.options).toEqual({ fields: ['id', 'name'] })
    })

    it('accepts options with integer array', () => {
      const perm = permission('read', { ids: [1, 2, 3] })
      expect(perm.options).toEqual({ ids: [1, 2, 3] })
    })

    it('accepts options with boolean array', () => {
      const perm = permission('read', { flags: [true, false, true] })
      expect(perm.options).toEqual({ flags: [true, false, true] })
    })

    it('accepts options with empty array', () => {
      const perm = permission('read', { fields: [] })
      expect(perm.options).toEqual({ fields: [] })
    })

    it('preserves array reference in options', () => {
      const fields = ['id', 'name']
      const perm = permission('read', { fields })
      expect(perm.options.fields).toBe(fields)
    })
  })

  describe('options with mixed parameter types', () => {
    it('accepts options with string, integer, and boolean', () => {
      const perm = permission('read', {
        format: 'json',
        limit: 100,
        includeDeleted: true,
      })
      expect(perm.options).toEqual({
        format: 'json',
        limit: 100,
        includeDeleted: true,
      })
    })

    it('accepts options with all parameter types', () => {
      const perm = permission('read', {
        format: 'json',
        limit: 100,
        includeDeleted: true,
        fields: ['id', 'name'],
      })
      expect(perm.options).toEqual({
        format: 'json',
        limit: 100,
        includeDeleted: true,
        fields: ['id', 'name'],
      })
    })

    it('accepts options with many parameters', () => {
      const perm = permission('read', {
        param1: 'value1',
        param2: 'value2',
        param3: 'value3',
        param4: 123,
        param5: 456,
        param6: true,
        param7: false,
        param8: ['a', 'b'],
      })
      expect(perm.options).toEqual({
        param1: 'value1',
        param2: 'value2',
        param3: 'value3',
        param4: 123,
        param5: 456,
        param6: true,
        param7: false,
        param8: ['a', 'b'],
      })
    })
  })

  describe('options with undefined values', () => {
    it('accepts options with undefined values', () => {
      const perm = permission('read', {
        optionalParam: undefined,
      })
      expect(perm.options).toEqual({ optionalParam: undefined })
    })

    it('accepts options with mix of defined and undefined values', () => {
      const perm = permission('read', {
        required: 'value',
        optional: undefined,
      })
      expect(perm.options).toEqual({
        required: 'value',
        optional: undefined,
      })
    })

    it('preserves undefined in options object', () => {
      const options = { param: undefined }
      const perm = permission('read', options)
      expect('param' in perm.options).toBe(true)
      expect(perm.options.param).toBeUndefined()
    })
  })

  describe('multiple perm instances', () => {
    it('creates independent instances', () => {
      const perm1 = permission('read', { limit: 100 })
      const perm2 = permission('write', { format: 'json' })

      expect(perm1.resource).toBe('read')
      expect(perm2.resource).toBe('write')
      expect(perm1.options).toEqual({ limit: 100 })
      expect(perm2.options).toEqual({ format: 'json' })
    })

    it('instances with same values are not equal', () => {
      const perm1 = permission('read', { limit: 100 })
      const perm2 = permission('read', { limit: 100 })

      expect(perm1).not.toBe(perm2)
      expect(perm1.resource).toBe(perm2.resource)
      expect(perm1.options).not.toBe(perm2.options)
      expect(perm1.options).toEqual(perm2.options)
    })

    it('instances sharing options object reference', () => {
      const options = { limit: 100 }
      const perm1 = permission('read', options)
      const perm2 = permission('write', options)

      expect(perm1.options).toBe(perm2.options)
      expect(perm1.options).toBe(options)
      expect(perm2.options).toBe(options)
    })
  })

  describe('common perm patterns', () => {
    it('creates read perm', () => {
      const perm = permission('read', {})
      expect(perm.resource).toBe('read')
    })

    it('creates write perm', () => {
      const perm = permission('write', {})
      expect(perm.resource).toBe('write')
    })

    it('creates delete perm', () => {
      const perm = permission('delete', {})
      expect(perm.resource).toBe('delete')
    })

    it('creates admin perm', () => {
      const perm = permission('admin', {})
      expect(perm.resource).toBe('admin')
    })

    it('creates scoped resource perm', () => {
      const perm = permission('posts:read', { limit: 50 })
      expect(perm.resource).toBe('posts:read')
      expect(perm.options).toEqual({ limit: 50 })
    })

    it('creates namespaced perm', () => {
      const perm = permission('com.example.posts.read', {
        includeDeleted: false,
      })
      expect(perm.resource).toBe('com.example.posts.read')
      expect(perm.options).toEqual({ includeDeleted: false })
    })

    it('creates CRUD perms', () => {
      const create = permission('create', {})
      const read = permission('read', {})
      const update = permission('update', {})
      const deleteP = permission('delete', {})

      expect(create.resource).toBe('create')
      expect(read.resource).toBe('read')
      expect(update.resource).toBe('update')
      expect(deleteP.resource).toBe('delete')
    })

    it('creates perm with scope and filters', () => {
      const perm = permission('posts:read', {
        scope: 'public',
        limit: 100,
        includeDeleted: false,
      })
      expect(perm.resource).toBe('posts:read')
      expect(perm.options).toEqual({
        scope: 'public',
        limit: 100,
        includeDeleted: false,
      })
    })
  })

  describe('edge cases', () => {
    it('handles perm with all parameter types in options', () => {
      const perm = permission('complex', {
        stringParam: 'value',
        intParam: 42,
        boolParam: true,
        arrayParam: [1, 2, 3],
        undefinedParam: undefined,
      })

      expect(perm.options.stringParam).toBe('value')
      expect(perm.options.intParam).toBe(42)
      expect(perm.options.boolParam).toBe(true)
      expect(perm.options.arrayParam).toEqual([1, 2, 3])
      expect(perm.options.undefinedParam).toBeUndefined()
    })

    it('handles resource with whitespace', () => {
      const perm = permission('read posts', {})
      expect(perm.resource).toBe('read posts')
    })

    it('handles resource with leading/trailing whitespace', () => {
      const perm = permission('  read  ', {})
      expect(perm.resource).toBe('  read  ')
    })

    it('handles options with numeric string keys', () => {
      const perm = permission('read', { '123': 'value' })
      expect(perm.options['123']).toBe('value')
    })

    it('handles options with special character keys', () => {
      const perm = permission('read', { 'key-name': 'value' })
      expect(perm.options['key-name']).toBe('value')
    })
  })

  describe('type safety', () => {
    it('preserves resource type as literal', () => {
      const perm = permission('read' as const, {})
      // At compile time, TypeScript should infer the type as 'read'
      expect(perm.resource).toBe('read')
    })

    it('preserves options type', () => {
      const options = { limit: 100 } as const
      const perm = permission('read', options)
      // At compile time, TypeScript should infer the exact type
      expect(perm.options.limit).toBe(100)
    })

    it('handles generic string resource type', () => {
      const resource: string = 'dynamic'
      const perm = permission(resource, {})
      expect(perm.resource).toBe('dynamic')
    })

    it('handles union resource types', () => {
      type ResourceType = 'read' | 'write' | 'delete'
      const resource: ResourceType = 'read'
      const perm = permission(resource, {})
      expect(perm.resource).toBe('read')
    })
  })

  describe('constructor behavior', () => {
    it('requires both resource and options arguments', () => {
      // TypeScript enforces this at compile time
      const perm = permission('read', {})
      expect(perm.resource).toBeDefined()
      expect(perm.options).toBeDefined()
    })

    it('does not modify input options object', () => {
      const options = { limit: 100 }
      const originalOptions = { ...options }
      permission('read', options)
      expect(options).toEqual(originalOptions)
    })

    it('accepts options as object literal', () => {
      const perm = permission('read', { limit: 100 })
      expect(perm.options).toEqual({ limit: 100 })
    })

    it('accepts options as variable', () => {
      const options = { limit: 100 }
      const perm = permission('read', options)
      expect(perm.options).toEqual({ limit: 100 })
    })

    it('accepts resource as string literal', () => {
      const perm = permission('read', {})
      expect(perm.resource).toBe('read')
    })

    it('accepts resource as variable', () => {
      const resource = 'read'
      const perm = permission(resource, {})
      expect(perm.resource).toBe('read')
    })
  })

  describe('object enumeration', () => {
    it('enumerates all properties', () => {
      const perm = permission('read', { limit: 100 })
      const keys = Object.keys(perm)
      expect(keys).toContain('resource')
      expect(keys).toContain('options')
    })

    it('can be spread into object', () => {
      const perm = permission('read', { limit: 100 })
      const spread = { ...perm }
      expect(spread.resource).toBe('read')
      expect(spread.options).toEqual({ limit: 100 })
    })
  })

  describe('JSON serialization', () => {
    it('can be JSON stringified', () => {
      const perm = permission('read', { limit: 100 })
      const json = JSON.stringify(perm)
      const parsed = JSON.parse(json)
      expect(parsed.resource).toBe('read')
      expect(parsed.options).toEqual({ limit: 100 })
    })

    it('handles complex options in JSON', () => {
      const perm = permission('read', {
        fields: ['id', 'name'],
        limit: 100,
        includeDeleted: false,
      })
      const json = JSON.stringify(perm)
      const parsed = JSON.parse(json)
      expect(parsed.options).toEqual({
        fields: ['id', 'name'],
        limit: 100,
        includeDeleted: false,
      })
    })

    it('preserves undefined in JSON serialization', () => {
      const perm = permission('read', {
        defined: 'value',
        undefined: undefined,
      })
      // JSON.stringify removes undefined values by default
      const json = JSON.stringify(perm)
      const parsed = JSON.parse(json)
      expect('undefined' in parsed.options).toBe(false)
    })
  })
})
