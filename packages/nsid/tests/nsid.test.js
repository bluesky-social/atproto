import { NSID } from '../src'

describe('NSID parsing, creation, and validation', () => {
  it('parses valid NSIDs', () => {
    expect(NSID.parse('com.example.foo').authority).toBe('example.com')
    expect(NSID.parse('com.example.foo').name).toBe('foo')
    expect(NSID.parse('com.example.foo').toString()).toBe('com.example.foo')
    expect(NSID.parse('com.example.*').authority).toBe('example.com')
    expect(NSID.parse('com.example.*').name).toBe('*')
    expect(NSID.parse('com.example.*').toString()).toBe('com.example.*')
    expect(NSID.parse('com.long-thing1.cool.fooBarBaz').authority).toBe(
      'cool.long-thing1.com',
    )
    expect(NSID.parse('com.long-thing1.cool.fooBarBaz').name).toBe('fooBarBaz')
    expect(NSID.parse('com.long-thing1.cool.fooBarBaz').toString()).toBe(
      'com.long-thing1.cool.fooBarBaz',
    )
  })
  it('creates valid NSIDs', () => {
    expect(NSID.create('example.com', 'foo').authority).toBe('example.com')
    expect(NSID.create('example.com', 'foo').name).toBe('foo')
    expect(NSID.create('example.com', 'foo').toString()).toBe('com.example.foo')
    expect(NSID.create('example.com', '*').authority).toBe('example.com')
    expect(NSID.create('example.com', '*').name).toBe('*')
    expect(NSID.create('example.com', '*').toString()).toBe('com.example.*')
    expect(NSID.create('cool.long-thing1.com', 'fooBarBaz').authority).toBe(
      'cool.long-thing1.com',
    )
    expect(NSID.create('cool.long-thing1.com', 'fooBarBaz').name).toBe(
      'fooBarBaz',
    )
    expect(NSID.create('cool.long-thing1.com', 'fooBarBaz').toString()).toBe(
      'com.long-thing1.cool.fooBarBaz',
    )
  })
  it('validates', () => {
    expect(NSID.isValid('com.1example.foo')).toBeFalsy()
    expect(NSID.isValid('com.example!.foo')).toBeFalsy()
    expect(NSID.isValid('com.example.*.foo')).toBeFalsy()
    expect(NSID.isValid('foo')).toBeFalsy()
    expect(NSID.isValid('foo/bar')).toBeFalsy()
  })
})
