import { useGetSessionQuery } from '../queries/use-get-session-query.ts'
import { JsonQueryResult } from './JsonQueryResult.tsx'
import { Button } from './_button.tsx'

export function SessionInfo() {
  const result = useGetSessionQuery()

  return (
    <div>
      <h2>
        getSession
        <Button
          onClick={() => result.refetch({ throwOnError: false })}
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
