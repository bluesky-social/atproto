import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppBskyEmbedPoll, AtpAgent, ids } from '@atproto/api'
import { RecordRef, SeedClient, TestNetwork } from '@atproto/dev-env'

describe('poll views', () => {
  let network: TestNetwork
  let agent: AtpAgent
  let pdsAgent: AtpAgent
  let sc: SeedClient

  // accounts
  let author: string
  let voter1: string
  let voter2: string
  let voter3: string
  let viewer: string

  const createPoll = async (
    by: string,
    text: string,
    options: string[],
    endsAt?: string,
  ): Promise<RecordRef> => {
    const res = await pdsAgent.app.bsky.poll.topic.create(
      { repo: by },
      { text, options, endsAt, createdAt: new Date().toISOString() },
      sc.getHeaders(by),
    )
    return new RecordRef(res.uri, res.cid)
  }

  const vote = async (
    by: string,
    poll: RecordRef,
    option: number,
    createdAt = new Date().toISOString(),
  ): Promise<RecordRef> => {
    const res = await pdsAgent.app.bsky.poll.vote.create(
      { repo: by },
      { subject: poll.raw, option, createdAt },
      sc.getHeaders(by),
    )
    return new RecordRef(res.uri, res.cid)
  }

  const postWithPoll = async (by: string, poll: RecordRef) => {
    return sc.post(by, 'check out my poll', undefined, undefined, undefined, {
      embed: {
        $type: 'app.bsky.embed.poll',
        poll: { uri: poll.uriStr, cid: poll.cidStr },
      },
    })
  }

  beforeAll(async () => {
    network = await TestNetwork.create({
      dbPostgresSchema: 'bsky_tests_polls',
    })
    agent = network.bsky.getAgent()
    pdsAgent = network.pds.getAgent()
    sc = network.getSeedClient()

    for (const name of ['author', 'voter1', 'voter2', 'voter3', 'viewer']) {
      await sc.createAccount(name, {
        handle: `${name}.test`,
        email: `${name}@test.com`,
        password: 'password',
      })
    }
    author = sc.dids.author
    voter1 = sc.dids.voter1
    voter2 = sc.dids.voter2
    voter3 = sc.dids.voter3
    viewer = sc.dids.viewer

    // viewer follows voter2 and voter3 (but not voter1) for facepile priority
    await sc.follow(viewer, voter2)
    await sc.follow(viewer, voter3)

    await network.processAll()
  })

  afterAll(async () => {
    await network.close()
  })

  const getPostEmbed = async (postUri: string, asViewer: string) => {
    const res = await agent.app.bsky.feed.getPosts(
      { uris: [postUri] },
      {
        headers: await network.serviceHeaders(
          asViewer,
          ids.AppBskyFeedGetPosts,
        ),
      },
    )
    return res.data.posts[0].embed
  }

  it('renders a poll embed with counts, viewer state, and follow-ordered facepile', async () => {
    const poll = await createPoll(author, 'best pet?', ['cats', 'dogs'])
    const post = await postWithPoll(author, poll)
    await vote(voter1, poll, 0)
    await vote(voter2, poll, 0)
    await vote(voter3, poll, 1)
    await network.processAll()

    const embed = await getPostEmbed(post.ref.uriStr, viewer)
    expect(AppBskyEmbedPoll.isView(embed)).toBe(true)
    const view = embed as AppBskyEmbedPoll.View
    expect(AppBskyEmbedPoll.isPollView(view.poll)).toBe(true)
    const pollView = view.poll as AppBskyEmbedPoll.PollView

    expect(pollView.uri).toBe(poll.uriStr)
    expect(pollView.text).toBe('best pet?')
    expect(pollView.voteCount).toBe(3)
    expect(pollView.isClosed).toBe(false)
    expect(pollView.options.map((o) => o.voteCount)).toEqual([2, 1])

    // option 0 facepile: voter2 (followed) should sort ahead of voter1
    const option0Voters = pollView.options[0].voters ?? []
    expect(option0Voters.length).toBe(2)
    expect(option0Voters[0].did).toBe(voter2)
    expect(option0Voters.map((v) => v.did)).toContain(voter1)
  })

  it('counts only the first vote per user (no double voting)', async () => {
    const poll = await createPoll(author, 'tabs or spaces?', ['tabs', 'spaces'])
    const post = await postWithPoll(author, poll)
    await vote(voter1, poll, 0)
    await network.processAll()
    // second vote by the same user on a different option is ignored
    await vote(voter1, poll, 1)
    await network.processAll()

    const embed = (await getPostEmbed(
      post.ref.uriStr,
      viewer,
    )) as AppBskyEmbedPoll.View
    const pollView = embed.poll as AppBskyEmbedPoll.PollView
    expect(pollView.voteCount).toBe(1)
    expect(pollView.options.map((o) => o.voteCount)).toEqual([1, 0])
  })

  it('exposes the viewer’s own vote', async () => {
    const poll = await createPoll(author, 'coffee or tea?', ['coffee', 'tea'])
    const post = await postWithPoll(author, poll)
    await vote(viewer, poll, 1)
    await network.processAll()

    const embed = (await getPostEmbed(
      post.ref.uriStr,
      viewer,
    )) as AppBskyEmbedPoll.View
    const pollView = embed.poll as AppBskyEmbedPoll.PollView
    expect(pollView.viewer?.option).toBe(1)
    expect(pollView.viewer?.vote).toBeDefined()
  })

  it('paginates voters via getVotes and filters by option', async () => {
    const poll = await createPoll(author, 'fav season?', ['summer', 'winter'])
    await vote(voter1, poll, 0)
    await vote(voter2, poll, 0)
    await vote(voter3, poll, 1)
    await network.processAll()

    const all = await agent.app.bsky.poll.getVotes(
      { uri: poll.uriStr },
      {
        headers: await network.serviceHeaders(viewer, ids.AppBskyPollGetVotes),
      },
    )
    expect(all.data.votes.length).toBe(3)

    const summerOnly = await agent.app.bsky.poll.getVotes(
      { uri: poll.uriStr, option: 0 },
      {
        headers: await network.serviceHeaders(viewer, ids.AppBskyPollGetVotes),
      },
    )
    expect(summerOnly.data.votes.length).toBe(2)
    expect(summerOnly.data.votes.every((v) => v.option === 0)).toBe(true)
  })

  it('getPoll returns the hydrated poll view', async () => {
    const poll = await createPoll(author, 'mountains or sea?', ['mtn', 'sea'])
    await vote(voter1, poll, 0)
    await network.processAll()

    const res = await agent.app.bsky.poll.getPoll(
      { uri: poll.uriStr },
      {
        headers: await network.serviceHeaders(viewer, ids.AppBskyPollGetPoll),
      },
    )
    expect(res.data.poll.uri).toBe(poll.uriStr)
    expect(res.data.poll.voteCount).toBe(1)
  })

  it('ignores votes cast after the poll closes', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const poll = await createPoll(author, 'already closed', ['a', 'b'], past)
    const post = await postWithPoll(author, poll)
    // ensure the poll (with its endsAt) is indexed before the late vote, so
    // the indexer can reject the vote as past the close time
    await network.processAll()
    await vote(voter1, poll, 0, new Date().toISOString())
    await network.processAll()

    const embed = (await getPostEmbed(
      post.ref.uriStr,
      viewer,
    )) as AppBskyEmbedPoll.View
    const pollView = embed.poll as AppBskyEmbedPoll.PollView
    expect(pollView.isClosed).toBe(true)
    expect(pollView.voteCount).toBe(0)
  })

  it('notifies the author and voters when a poll closes', async () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    // vote created before the close time so it is counted
    const beforeClose = new Date(Date.now() - 120_000).toISOString()
    const poll = await createPoll(author, 'closing soon', ['x', 'y'], past)
    await vote(voter1, poll, 0, beforeClose)
    await network.processAll()

    // trigger the time-based sweep deterministically
    await network.bsky.dataplane.pollCloser.run()

    const forAuthor = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          author,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const authorNotif = forAuthor.data.notifications.find(
      (n) => n.reason === 'poll-ended' && n.reasonSubject === poll.uriStr,
    )
    expect(authorNotif).toBeDefined()

    const forVoter = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          voter1,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const voterNotif = forVoter.data.notifications.find(
      (n) => n.reason === 'poll-ended' && n.reasonSubject === poll.uriStr,
    )
    expect(voterNotif).toBeDefined()

    // a second sweep is idempotent (no duplicate notification)
    await network.bsky.dataplane.pollCloser.run()
    const forVoterAgain = await agent.app.bsky.notification.listNotifications(
      {},
      {
        headers: await network.serviceHeaders(
          voter1,
          ids.AppBskyNotificationListNotifications,
        ),
      },
    )
    const voterNotifs = forVoterAgain.data.notifications.filter(
      (n) => n.reason === 'poll-ended' && n.reasonSubject === poll.uriStr,
    )
    expect(voterNotifs.length).toBe(1)
  })
})
