import { UseQueryResult, useQuery } from '@tanstack/react-query'
import { JSX, useEffect } from 'react'
import ReactJson from 'react-json-view'
import { Agent } from '@atproto/api'
import { OAuthSession } from '@atproto/oauth-client'
import { useAuthContext } from './auth/auth-provider.tsx'

function App() {
  const { pdsAgent, signOut, refresh } = useAuthContext()

  // Expose agent globally
  const global = window as { pdsAgent?: Agent }
  useEffect(() => {
    global.pdsAgent = pdsAgent
    return () => {
      if (global.pdsAgent === pdsAgent) {
        delete global.pdsAgent
      }
    }
  }, [pdsAgent])

  return (
    <div>
      <p>
        Logged in!
        <div className="ml-2 inline-flex flex-wrap space-x-2">
          <Button onClick={refresh}>Refresh tokens</Button>
          <Button onClick={signOut}>Sign-out</Button>
        </div>
      </p>

      {pdsAgent.sessionManager instanceof OAuthSession && <TokenInfo />}
      <SessionInfo />
      <ProfileInfo />
    </div>
  )
}

export default App

function TokenInfo() {
  const { pdsAgent } = useAuthContext()
  const { sessionManager } = pdsAgent

  const oauthSession =
    sessionManager instanceof OAuthSession ? sessionManager : null

  const result = useQuery({
    queryKey: ['tokeninfo', pdsAgent.assertDid],
    queryFn: async () => oauthSession?.getTokenInfo(),
  })

  return (
    <div>
      <h2>
        Token info
        <Button
          className="ml-2"
          onClick={() => result.refetch({ throwOnError: false })}
        >
          refresh
        </Button>
      </h2>
      <QueryResult result={result} />
    </div>
  )
}

function ProfileInfo() {
  const { pdsAgent } = useAuthContext()

  const result = useQuery({
    queryKey: ['profile', pdsAgent.assertDid],
    queryFn: async () => {
      const { data } = await pdsAgent.com.atproto.repo.getRecord({
        repo: pdsAgent.assertDid,
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
      })
      return data
    },
  })

  return (
    <div>
      <h2>
        Profile
        <Button
          className="ml-2"
          onClick={() => result.refetch({ throwOnError: false })}
        >
          refresh
        </Button>
      </h2>
      <QueryResult result={result} />
    </div>
  )
}

function SessionInfo() {
  const { pdsAgent } = useAuthContext()

  const result = useQuery({
    queryKey: ['session', pdsAgent.assertDid],
    queryFn: async () => {
      const { data } = await pdsAgent.com.atproto.server.getSession()
      return data
    },
  })

  return (
    <div>
      <h2>
        getSession
        <Button
          className="ml-2"
          onClick={() => result.refetch({ throwOnError: false })}
        >
          refresh
        </Button>
      </h2>
      <QueryResult result={result} />
    </div>
  )
}

function QueryResult({ result }: { result: UseQueryResult }) {
  return (
    <div>
      {result.data !== undefined ? (
        result.data === null ? (
          'null'
        ) : (
          <ReactJson
            src={result.data}
            indentWidth={2}
            displayDataTypes={false}
          />
        )
      ) : result.isLoading ? (
        <p>Loading...</p>
      ) : result.isError ? (
        <p>Error: {String(result.error)}</p>
      ) : (
        <p>Error: no-data</p>
      )}
    </div>
  )
}

function Button({
  children,
  className,
  ...props
}: JSX.IntrinsicElements['button']) {
  return (
    <button
      {...props}
      className={`inline-block transform rounded bg-cyan-300 px-2 py-1 text-black shadow-lg transition duration-300 ease-in-out hover:scale-105 hover:bg-cyan-500 ${className || ''}`}
    >
      {children}
    </button>
  )
}
