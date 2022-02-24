import test from 'ava'
import TID from '../src/user-store/tid.js'

test('Creates new TID', (t) => {
  const tid = TID.now()
  const str = tid.toString()
  t.is(typeof str, 'string', 'Is a string')
  t.is(str.toString().length, 13, 'Is the proper length')
})

test('Can parse a TID', (t) => {
  const tid = TID.now()
  const str = tid.toString()
  const parsed = TID.parse(str)
  t.is(parsed.time, tid.time, 'Preserves time')
  t.is(parsed.clockid, tid.clockid, 'Preserves clockid')
})
