import { l } from '..'

describe('public interface', () => {
  it('exposes l.object', () => {
    const schema = l.object({ name: l.string(), age: l.integer() })
    expect(schema.parse({ name: 'Alice', age: 30 })).toEqual({
      name: 'Alice',
      age: 30,
    })
  })
})
