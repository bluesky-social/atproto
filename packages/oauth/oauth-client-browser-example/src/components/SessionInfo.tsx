import { useGetSessionQuery } from '../queries/use-get-session-query.ts'
import { Button } from './Button.tsx'
import { JsonQueryResult } from './JsonQueryResult.tsx'

export function SessionInfo() {
  const result = useGetSessionQuery()

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
      <JsonQueryResult result={result} />
    </div>
  )
}
