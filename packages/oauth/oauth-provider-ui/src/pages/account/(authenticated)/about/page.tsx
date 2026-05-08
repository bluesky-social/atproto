import { Trans } from '@lingui/react/macro'
import { CustomizationName } from '#/components/customization-name.tsx'
import { AccountIdentifier } from '#/components/utils/account-identifier'
import { LinkExternal } from '#/components/utils/link-external'
import { useAuthenticatedSession } from '#/contexts/authentication'

export function Page() {
  const { account } = useAuthenticatedSession()

  return (
    <div className="prose-sm md:prose prose-slate dark:prose-invert max-w-none">
      <section>
        <Trans>
          <h2>What is an Atmosphere account?</h2>
          <p>
            An <strong>Atmosphere account</strong> is your personal identity on
            the Atmosphere. Think of it as a digital passport that you truly
            own, not locked to any single app or company.
          </p>
        </Trans>
      </section>

      <section>
        <Trans>
          <h3>Use it across multiple apps</h3>
          <p>
            Your Atmosphere account works with the{' '}
            <LinkExternal className="underline" href="https://bsky.app">
              Bluesky Social App
            </LinkExternal>{' '}
            and any other social apps built on the same network.
          </p>
          <p>
            Just like you can use the same email address to sign into different
            websites, your Atmosphere account lets you sign into different
            social apps while keeping the same identity, connections, and
            content.
          </p>
          <p>
            When you see options to log in with an Atmosphere account or
            "internet handle" on other apps, you can use your existing account{' '}
            <strong className="whitespace-nowrap">
              <AccountIdentifier account={account} />
            </strong>{' '}
            instead of creating a new one.
          </p>
        </Trans>
      </section>

      <section>
        <Trans>
          <h3>What makes it special</h3>
          <p>
            The key difference: your data isn't trapped in any one app. Unlike
            traditional social media accounts, where your data belongs to the
            platform, with an Atmosphere account you genuinely own your identity
            and data:
          </p>
          <ul>
            <li>
              <strong>You own your identity</strong>: Your username (handle) and
              permanent ID belong to you
            </li>
            <li>
              <strong>Your data is portable</strong>: Posts, follows, and
              content live in your personal data storage, not locked in an app's
              database
            </li>
            <li>
              <strong>You can move freely</strong>: Switch hosting providers
              without losing your followers, posts, or connections. This also
              lets you choose a provider in your country if it matters where
              your data is stored.
            </li>
            <li>
              <strong>Multiple apps, one identity</strong>: Use the same account
              across different apps built on the same network
            </li>
          </ul>
        </Trans>
      </section>

      <section>
        <Trans>
          <h3>This website: your account control center</h3>
          <p>
            The website you're on right now is your{' '}
            <strong>account management hub</strong>. Here you can:
          </p>
          <ul>
            <li>Update your email address and password</li>
            <li>Manage your personal data and security settings</li>
            <li>
              View and manage active sessions across devices (browsers where
              you're signed in)
            </li>
          </ul>
          <p>
            This place is where you control the fundamental aspects of your
            Atmosphere identity, independently of any app-specific details like
            the profile you have on the{' '}
            <LinkExternal
              href={`https://bsky.app/profile/${account.preferred_username ?? account.sub}`}
            >
              Bluesky social app
            </LinkExternal>
            .
          </p>
          <p>
            Your Atmosphere account is currently hosted by <CustomizationName />
            , one of many hosting providers in the Atmosphere network. You can
            switch to a different one at any time without losing your account,
            identity, or data.
          </p>
        </Trans>
      </section>

      <section>
        <Trans>
          <h3>Learn more</h3>
          <p>
            Want to learn more about the technology and network behind your
            Atmosphere account?
          </p>
        </Trans>
        <ul>
          <li>
            <Trans>
              <LinkExternal className="underline" href="https://bsky.social">
                Bluesky Social
              </LinkExternal>{' '}
              — General information about the network
            </Trans>
          </li>
          <li>
            <Trans>
              <LinkExternal className="underline" href="https://atproto.com">
                AT Protocol
              </LinkExternal>{' '}
              — Technical documentation for developers
            </Trans>
          </li>
        </ul>
      </section>
    </div>
  )
}
