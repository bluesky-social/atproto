import test from 'ava'
import http from 'http'
import runServer from '../src/server'
import Client from '../src/client'
import { ChannelMessage } from '../src/messages'

let server: http.Server

test('test', async (t) => {
  const client1 = await new Client('http://localhost:3005', 'topic')
  const client2 = await new Client('http://localhost:3005', 'topic')

  client1.onMessage = async (msg: ChannelMessage) => {
    console.log('CLIENT 1 got message: ', msg)
  }

  client2.sendMessage({ blah: 123 })

  await wait(2000)
  client1.close()
  client2.close()
  t.pass('pass')
})

const wait = (time: number) => {
  return new Promise((resolve) => setTimeout(resolve, time))
}
