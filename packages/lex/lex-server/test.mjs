/* eslint-env node */

import { l } from '@atproto/lex'
import { LexRouter } from './dist/lex-server.js'
import { startServer } from './dist/nodejs.js'

const echoMessage = l.typedObject(
  'com.example.echo',
  'echoMessage',
  l.object({
    message: l.string(),
  }),
)

const sub = l.subscription(
  'com.example.echo',
  l.params({
    message: l.string({ minLength: 1 }),
  }),
  l.typedUnion(
    [
      //
      l.typedRef(() => echoMessage),
    ],
    false,
  ),
)

const router = new LexRouter({
  onMethodNotFound: () => {
    return new Response('<h1>404 Not Found</h1>', {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    })
  },
})
  //
  .add(sub, async function* ({ params: { message } }) {
    try {
      while (true) {
        yield echoMessage.$build({ message })
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    } finally {
      console.log('Subscription ended')
    }
  })

startServer(router, {
  port: 8080,
  onError: (err) => {
    console.error('Server error:', err)
  },
}).then((server) => {
  const { port } = server.address()
  console.log(`Server is running on http://localhost:${port}`)
})
