import test from 'ava'
import Timestamp from '../src/timestamp.js'

test('Creates new timestamp', (t) => {
  const timestamp = Timestamp.now()
  const str = timestamp.toString()
  t.is(typeof str, 'string', 'Is a string')
  t.is(str.toString().length, 11, 'Is the proper length')
})

test('Can parse a timestamp', (t) => {
  const timestamp = Timestamp.now()
  const str = timestamp.toString()
  const parsed = Timestamp.parse(str)
  t.is(parsed.time, timestamp.time, 'Preserves time')
  t.is(parsed.clockid, timestamp.clockid, 'Preserves clockid')
})
