import test from 'ava'
import TID from '../src/repo/tid.js'

test('Creates new TID', (t) => {
  const tid = TID.next()
  const str = tid.toString()
  t.is(typeof str, 'string', 'Is a string')
  t.is(str.toString().length, 13, 'Is the proper length')
})

test('Can parse a TID', (t) => {
  const tid = TID.next()
  const str = tid.toString()
  const parsed = TID.fromStr(str)
  t.is(parsed.timestamp(), tid.timestamp(), 'Preserves time')
  t.is(parsed.clockid(), tid.clockid(), 'Preserves clockid')
})
