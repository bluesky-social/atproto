import { describe, expect, it } from 'vitest'
import { Permission } from './permission.js'

describe('Permission', () => {
  describe('basic construction', () => {
    it('creates a permission with resource and empty options', () => {
      const permission = new Permission('read', {})
      expect(permission.resource).toBe('read')
      expect(permission.options).toEqual({})
    })

    it('creates a permission with resource and options', () => {
      const options = { limit: 100 }
      const permission = new Permission('read', options)
      expect(permission.resource).toBe('read')
      expect(permission.options).toEqual({ limit: 100 })
    })

    it('preserves the options object reference', () => {
      const options = { limit: 100 }
      const permission = new Permission('read', options)
      expect(permission.options).toBe(options)
    })

    it('preserves resource as const literal type', () => {
      const permission = new Permission('read' as const, {})
      expect(permission.resource).toBe('read')
    })
  })

  describe('resource strings', () => {
    it('handles simple resource names', () => {
      const permission = new Permission('read', {})
      expect(permission.resource).toBe('read')
    })

    it('handles namespaced resource names', () => {
      const permission = new Permission('com.example.read', {})
      expect(permission.resource).toBe('com.example.read')
    })

    it('handles resource names with dashes', () => {
      const permission = new Permission('read-posts', {})
      expect(permission.resource).toBe('read-posts')
    })

    it('handles resource names with underscores', () => {
      const permission = new Permission('read_posts', {})
      expect(permission.resource).toBe('read_posts')
    })

    it('handles resource names with colons', () => {
      const permission = new Permission('posts:read', {})
      expect(permission.resource).toBe('posts:read')
    })

    it('handles resource names with slashes', () => {
      const permission = new Permission('posts/read', {})
      expect(permission.resource).toBe('posts/read')
    })

    it('handles resource names with wildcards', () => {
      const permission = new Permission('posts:*', {})
      expect(permission.resource).toBe('posts:*')
    })

    it('handles empty resource string', () => {
      const permission = new Permission('', {})
      expect(permission.resource).toBe('')
    })

    it('handles very long resource strings', () => {
      const longResource = 'com.example.service.'.repeat(50) + 'read'
      const permission = new Permission(longResource, {})
      expect(permission.resource).toBe(longResource)
    })

    it('handles resource strings with unicode characters', () => {
      const permission = new Permission('リソース', {})
      expect(permission.resource).toBe('リソース')
    })

    it('handles resource strings with special characters', () => {
      const permission = new Permission('resource@#$%', {})
      expect(permission.resource).toBe('resource@#$%')
    })
  })

  describe('options with string parameters', () => {
    it('accepts empty options object', () => {
      const permission = new Permission('read', {})
      expect(permission.options).toEqual({})
    })

    it('accepts options with string value', () => {
      const permission = new Permission('read', { format: 'json' })
      expect(permission.options).toEqual({ format: 'json' })
    })

    it('accepts options with multiple string values', () => {
      const permission = new Permission('read', {
        format: 'json',
        encoding: 'utf-8',
      })
      expect(permission.options).toEqual({ format: 'json', encoding: 'utf-8' })
    })

    it('accepts options with empty string value', () => {
      const permission = new Permission('read', { filter: '' })
      expect(permission.options).toEqual({ filter: '' })
    })

    it('accepts options with very long string values', () => {
      const longString = 'value'.repeat(1000)
      const permission = new Permission('read', { data: longString })
      expect(permission.options.data).toBe(longString)
    })
  })

  describe('options with integer parameters', () => {
    it('accepts options with positive integer', () => {
      const permission = new Permission('read', { limit: 100 })
      expect(permission.options).toEqual({ limit: 100 })
    })

    it('accepts options with zero', () => {
      const permission = new Permission('read', { offset: 0 })
      expect(permission.options).toEqual({ offset: 0 })
    })

    it('accepts options with negative integer', () => {
      const permission = new Permission('read', { delta: -50 })
      expect(permission.options).toEqual({ delta: -50 })
    })

    it('accepts options with multiple integers', () => {
      const permission = new Permission('read', {
        limit: 100,
        offset: 20,
        maxRetries: 3,
      })
      expect(permission.options).toEqual({
        limit: 100,
        offset: 20,
        maxRetries: 3,
      })
    })

    it('accepts options with large integers', () => {
      const permission = new Permission('read', { maxSize: 2147483647 })
      expect(permission.options).toEqual({ maxSize: 2147483647 })
    })
  })

  describe('options with boolean parameters', () => {
    it('accepts options with true boolean', () => {
      const permission = new Permission('read', { includeDeleted: true })
      expect(permission.options).toEqual({ includeDeleted: true })
    })

    it('accepts options with false boolean', () => {
      const permission = new Permission('read', { includeDeleted: false })
      expect(permission.options).toEqual({ includeDeleted: false })
    })

    it('accepts options with multiple booleans', () => {
      const permission = new Permission('read', {
        includeDeleted: true,
        includeDrafts: false,
        includeArchived: true,
      })
      expect(permission.options).toEqual({
        includeDeleted: true,
        includeDrafts: false,
        includeArchived: true,
      })
    })
  })

  describe('options with array parameters', () => {
    it('accepts options with string array', () => {
      const permission = new Permission('read', { fields: ['id', 'name'] })
      expect(permission.options).toEqual({ fields: ['id', 'name'] })
    })

    it('accepts options with integer array', () => {
      const permission = new Permission('read', { ids: [1, 2, 3] })
      expect(permission.options).toEqual({ ids: [1, 2, 3] })
    })

    it('accepts options with boolean array', () => {
      const permission = new Permission('read', { flags: [true, false, true] })
      expect(permission.options).toEqual({ flags: [true, false, true] })
    })

    it('accepts options with empty array', () => {
      const permission = new Permission('read', { fields: [] })
      expect(permission.options).toEqual({ fields: [] })
    })

    it('preserves array reference in options', () => {
      const fields = ['id', 'name']
      const permission = new Permission('read', { fields })
      expect(permission.options.fields).toBe(fields)
    })
  })

  describe('options with mixed parameter types', () => {
    it('accepts options with string, integer, and boolean', () => {
      const permission = new Permission('read', {
        format: 'json',
        limit: 100,
        includeDeleted: true,
      })
      expect(permission.options).toEqual({
        format: 'json',
        limit: 100,
        includeDeleted: true,
      })
    })

    it('accepts options with all parameter types', () => {
      const permission = new Permission('read', {
        format: 'json',
        limit: 100,
        includeDeleted: true,
        fields: ['id', 'name'],
      })
      expect(permission.options).toEqual({
        format: 'json',
        limit: 100,
        includeDeleted: true,
        fields: ['id', 'name'],
      })
    })

    it('accepts options with many parameters', () => {
      const permission = new Permission('read', {
        param1: 'value1',
        param2: 'value2',
        param3: 'value3',
        param4: 123,
        param5: 456,
        param6: true,
        param7: false,
        param8: ['a', 'b'],
      })
      expect(permission.options).toEqual({
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
      const permission = new Permission('read', {
        optionalParam: undefined,
      })
      expect(permission.options).toEqual({ optionalParam: undefined })
    })

    it('accepts options with mix of defined and undefined values', () => {
      const permission = new Permission('read', {
        required: 'value',
        optional: undefined,
      })
      expect(permission.options).toEqual({
        required: 'value',
        optional: undefined,
      })
    })

    it('preserves undefined in options object', () => {
      const options = { param: undefined }
      const permission = new Permission('read', options)
      expect('param' in permission.options).toBe(true)
      expect(permission.options.param).toBeUndefined()
    })
  })

  describe('multiple permission instances', () => {
    it('creates independent instances', () => {
      const permission1 = new Permission('read', { limit: 100 })
      const permission2 = new Permission('write', { format: 'json' })

      expect(permission1.resource).toBe('read')
      expect(permission2.resource).toBe('write')
      expect(permission1.options).toEqual({ limit: 100 })
      expect(permission2.options).toEqual({ format: 'json' })
    })

    it('instances with same values are not equal', () => {
      const permission1 = new Permission('read', { limit: 100 })
      const permission2 = new Permission('read', { limit: 100 })

      expect(permission1).not.toBe(permission2)
      expect(permission1.resource).toBe(permission2.resource)
      expect(permission1.options).not.toBe(permission2.options)
      expect(permission1.options).toEqual(permission2.options)
    })

    it('instances sharing options object reference', () => {
      const options = { limit: 100 }
      const permission1 = new Permission('read', options)
      const permission2 = new Permission('write', options)

      expect(permission1.options).toBe(permission2.options)
      expect(permission1.options).toBe(options)
      expect(permission2.options).toBe(options)
    })
  })

  describe('common permission patterns', () => {
    it('creates read permission', () => {
      const permission = new Permission('read', {})
      expect(permission.resource).toBe('read')
    })

    it('creates write permission', () => {
      const permission = new Permission('write', {})
      expect(permission.resource).toBe('write')
    })

    it('creates delete permission', () => {
      const permission = new Permission('delete', {})
      expect(permission.resource).toBe('delete')
    })

    it('creates admin permission', () => {
      const permission = new Permission('admin', {})
      expect(permission.resource).toBe('admin')
    })

    it('creates scoped resource permission', () => {
      const permission = new Permission('posts:read', { limit: 50 })
      expect(permission.resource).toBe('posts:read')
      expect(permission.options).toEqual({ limit: 50 })
    })

    it('creates namespaced permission', () => {
      const permission = new Permission('com.example.posts.read', {
        includeDeleted: false,
      })
      expect(permission.resource).toBe('com.example.posts.read')
      expect(permission.options).toEqual({ includeDeleted: false })
    })

    it('creates CRUD permissions', () => {
      const create = new Permission('create', {})
      const read = new Permission('read', {})
      const update = new Permission('update', {})
      const deleteP = new Permission('delete', {})

      expect(create.resource).toBe('create')
      expect(read.resource).toBe('read')
      expect(update.resource).toBe('update')
      expect(deleteP.resource).toBe('delete')
    })

    it('creates permission with scope and filters', () => {
      const permission = new Permission('posts:read', {
        scope: 'public',
        limit: 100,
        includeDeleted: false,
      })
      expect(permission.resource).toBe('posts:read')
      expect(permission.options).toEqual({
        scope: 'public',
        limit: 100,
        includeDeleted: false,
      })
    })
  })

  describe('edge cases', () => {
    it('handles permission with all parameter types in options', () => {
      const permission = new Permission('complex', {
        stringParam: 'value',
        intParam: 42,
        boolParam: true,
        arrayParam: [1, 2, 3],
        undefinedParam: undefined,
      })

      expect(permission.options.stringParam).toBe('value')
      expect(permission.options.intParam).toBe(42)
      expect(permission.options.boolParam).toBe(true)
      expect(permission.options.arrayParam).toEqual([1, 2, 3])
      expect(permission.options.undefinedParam).toBeUndefined()
    })

    it('handles resource with whitespace', () => {
      const permission = new Permission('read posts', {})
      expect(permission.resource).toBe('read posts')
    })

    it('handles resource with leading/trailing whitespace', () => {
      const permission = new Permission('  read  ', {})
      expect(permission.resource).toBe('  read  ')
    })

    it('handles options with numeric string keys', () => {
      const permission = new Permission('read', { '123': 'value' })
      expect(permission.options['123']).toBe('value')
    })

    it('handles options with special character keys', () => {
      const permission = new Permission('read', { 'key-name': 'value' })
      expect(permission.options['key-name']).toBe('value')
    })
  })

  describe('type safety', () => {
    it('preserves resource type as literal', () => {
      const permission = new Permission('read' as const, {})
      // At compile time, TypeScript should infer the type as 'read'
      expect(permission.resource).toBe('read')
    })

    it('preserves options type', () => {
      const options = { limit: 100 } as const
      const permission = new Permission('read', options)
      // At compile time, TypeScript should infer the exact type
      expect(permission.options.limit).toBe(100)
    })

    it('handles generic string resource type', () => {
      const resource: string = 'dynamic'
      const permission = new Permission(resource, {})
      expect(permission.resource).toBe('dynamic')
    })

    it('handles union resource types', () => {
      type ResourceType = 'read' | 'write' | 'delete'
      const resource: ResourceType = 'read'
      const permission = new Permission(resource, {})
      expect(permission.resource).toBe('read')
    })
  })

  describe('constructor behavior', () => {
    it('requires both resource and options arguments', () => {
      // TypeScript enforces this at compile time
      const permission = new Permission('read', {})
      expect(permission.resource).toBeDefined()
      expect(permission.options).toBeDefined()
    })

    it('does not modify input options object', () => {
      const options = { limit: 100 }
      const originalOptions = { ...options }
      new Permission('read', options)
      expect(options).toEqual(originalOptions)
    })

    it('accepts options as object literal', () => {
      const permission = new Permission('read', { limit: 100 })
      expect(permission.options).toEqual({ limit: 100 })
    })

    it('accepts options as variable', () => {
      const options = { limit: 100 }
      const permission = new Permission('read', options)
      expect(permission.options).toEqual({ limit: 100 })
    })

    it('accepts resource as string literal', () => {
      const permission = new Permission('read', {})
      expect(permission.resource).toBe('read')
    })

    it('accepts resource as variable', () => {
      const resource = 'read'
      const permission = new Permission(resource, {})
      expect(permission.resource).toBe('read')
    })
  })

  describe('object enumeration', () => {
    it('enumerates all properties', () => {
      const permission = new Permission('read', { limit: 100 })
      const keys = Object.keys(permission)
      expect(keys).toContain('resource')
      expect(keys).toContain('options')
    })

    it('can be spread into object', () => {
      const permission = new Permission('read', { limit: 100 })
      const spread = { ...permission }
      expect(spread.resource).toBe('read')
      expect(spread.options).toEqual({ limit: 100 })
    })
  })

  describe('JSON serialization', () => {
    it('can be JSON stringified', () => {
      const permission = new Permission('read', { limit: 100 })
      const json = JSON.stringify(permission)
      const parsed = JSON.parse(json)
      expect(parsed.resource).toBe('read')
      expect(parsed.options).toEqual({ limit: 100 })
    })

    it('handles complex options in JSON', () => {
      const permission = new Permission('read', {
        fields: ['id', 'name'],
        limit: 100,
        includeDeleted: false,
      })
      const json = JSON.stringify(permission)
      const parsed = JSON.parse(json)
      expect(parsed.options).toEqual({
        fields: ['id', 'name'],
        limit: 100,
        includeDeleted: false,
      })
    })

    it('preserves undefined in JSON serialization', () => {
      const permission = new Permission('read', {
        defined: 'value',
        undefined: undefined,
      })
      // JSON.stringify removes undefined values by default
      const json = JSON.stringify(permission)
      const parsed = JSON.parse(json)
      expect('undefined' in parsed.options).toBe(false)
    })
  })
})
