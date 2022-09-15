import { parse, create, isValid, NSID } from '../src'

describe('NSID parsing, creation, and validation', () => {
  it('parses valid NSIDs', () => {
    expect(parse('com.example.foo').authority).toBe('example.com')
    expect(parse('com.example.foo').name).toBe('foo')
    expect(parse('com.example.foo').toString()).toBe('com.example.foo')
    expect(parse('com.example.*').authority).toBe('example.com')
    expect(parse('com.example.*').name).toBe('*')
    expect(parse('com.example.*').toString()).toBe('com.example.*')
    expect(parse('com.long-thing1.cool.fooBarBaz').authority).toBe(
      'cool.long-thing1.com',
    )
    expect(parse('com.long-thing1.cool.fooBarBaz').name).toBe('fooBarBaz')
    expect(parse('com.long-thing1.cool.fooBarBaz').toString()).toBe(
      'com.long-thing1.cool.fooBarBaz',
    )
  })
  it('creates valid NSIDs', () => {
    expect(create('example.com', 'foo').authority).toBe('example.com')
    expect(create('example.com', 'foo').name).toBe('foo')
    expect(create('example.com', 'foo').toString()).toBe('com.example.foo')
    expect(create('example.com', '*').authority).toBe('example.com')
    expect(create('example.com', '*').name).toBe('*')
    expect(create('example.com', '*').toString()).toBe('com.example.*')
    expect(create('cool.long-thing1.com', 'fooBarBaz').authority).toBe(
      'cool.long-thing1.com',
    )
    expect(create('cool.long-thing1.com', 'fooBarBaz').name).toBe('fooBarBaz')
    expect(create('cool.long-thing1.com', 'fooBarBaz').toString()).toBe(
      'com.long-thing1.cool.fooBarBaz',
    )
  })
  it('validates', () => {
    expect(isValid('com.1example.foo')).toBeFalsy()
    expect(isValid('com.example!.foo')).toBeFalsy()
    expect(isValid('com.example.*.foo')).toBeFalsy()
    expect(isValid('foo')).toBeFalsy()
    expect(isValid('foo/bar')).toBeFalsy()
  })
})
