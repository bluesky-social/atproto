export const users = {
  alice: {
    email: 'alice@test.com',
    name: 'alice.test',
    did: 'did:test:alice',
    password: 'alice-pass',
    displayName: 'ali',
    description: 'its me!',
  },
  bob: {
    email: 'bob@test.com',
    name: 'bob.test',
    did: 'did:test:bob',
    password: 'bob-pass',
    displayName: 'bobby',
    description: 'hi im bob',
  },
  carol: {
    email: 'carol@test.com',
    name: 'carol.test',
    did: 'did:test:carol',
    password: 'carol-pass',
    displayName: undefined,
    description: undefined,
  },
  dan: {
    email: 'dan@test.com',
    name: 'dan.test',
    did: 'did:test:dan',
    password: 'dan-pass',
    displayName: undefined,
    description: undefined,
  },
}

export const posts = {
  alice: ['hey there', 'again', 'yoohoo'],
  bob: ['bob back at it again!', 'bobby boy here', 'yoohoo'],
  carol: ['hi im carol'],
  dan: ['dan here!', '@carol.bluesky.xyz is the best'],
}

export const replies = {
  alice: ['thanks bob'],
  bob: ['hear that'],
  carol: ['of course'],
}
