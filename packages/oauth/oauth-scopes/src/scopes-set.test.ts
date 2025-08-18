import { ScopesSet } from './scopes-set.js'

describe('ScopesSet', () => {
  it('should initialize with an empty set', () => {
    const set = new ScopesSet()
    expect(set.size).toBe(0)
  })

  it('should add scopes correctly', () => {
    const set = new ScopesSet()
    set.add('repo:read')
    expect(set.size).toBe(1)
    expect(set.has('repo:read')).toBe(true)
    expect(set.has('repo:write')).toBe(false)
  })

  it('should remove scopes correctly', () => {
    const set = new ScopesSet(['repo:read'])
    set.delete('repo:read')
    expect(set.size).toBe(0)
    expect(set.has('repo:read')).toBe(false)
  })

  it('should match included scopes', () => {
    const set = new ScopesSet(['repo:com.example.foo'])
    expect(
      set.matches('repo', { action: 'create', collection: 'com.example.foo' }),
    ).toBe(true)
    expect(
      set.matches('repo', { action: 'create', collection: 'com.example.bar' }),
    ).toBe(false)
  })

  it('should not match missing scopes', () => {
    const set = new ScopesSet(['repo:com.example.foo?action=create'])
    expect(
      set.matches('repo', { action: 'delete', collection: 'com.example.foo' }),
    ).toBe(false)
  })

  it('should not match invalid scopes', () => {
    const set = new ScopesSet(['repo:not-a-valid-nsid'])
    expect(
      set.matches('repo', { action: 'create', collection: 'not-a-valid-nsid' }),
    ).toBe(false)
  })
})
