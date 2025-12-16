import { com } from '../lexicons.ts'
import { useLexQuery } from '../queries/use-lex-query.ts'
import { Button } from './Button.tsx'
import { JsonQueryResult } from './JsonQueryResult.tsx'

export function SessionInfo() {
  const result = useLexQuery(com.atproto.server.getSession)

  return (
    <div>
      <h2>
        getSession
        <Button
          action={async () => result.refetch({ throwOnError: false })}
          className="ml-1"
          size="small"
          transparent
        >
          refresh
        </Button>
      </h2>
      <JsonQueryResult result={result} transform={(data) => data.body} />
    </div>
  )
}
