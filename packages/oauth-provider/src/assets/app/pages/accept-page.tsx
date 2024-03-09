import { AcceptForm, AcceptFormProps } from '../components/accept-form'
import { PageLayout } from '../components/page-layout'

export type AcceptPageProps = AcceptFormProps

export function AcceptPage(props: AcceptPageProps) {
  const { account } = props
  const accountName = account.preferred_username || account.email || account.sub

  return (
    <PageLayout
      column={
        <>
          <h1 className="text-2xl mt-4 font-semibold mb-4 text-primary">
            Authorize
          </h1>
          <p>
            Grant access to your <b>{accountName}</b> account.
          </p>
        </>
      }
    >
      <AcceptForm {...props} className="max-w-lg w-full"></AcceptForm>
    </PageLayout>
  )
}
