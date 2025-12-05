import { JSX } from 'react'
import { Button } from '../components/Button.tsx'
import { AtmosphereSignInForm } from './AtmosphereSignInForm.tsx'

export type AtmosphereSignInDialogProps = JSX.IntrinsicElements['div'] & {
  signIn: (input: string) => Promise<void>
  disabled?: boolean
  loading?: boolean
  signUpUrl?: string
}

export function AtmosphereSignInDialog({
  signIn,
  loading,
  disabled,
  signUpUrl,

  // div
  className = '',
  role = 'dialog',
  ...props
}: AtmosphereSignInDialogProps) {
  return (
    <div
      role={role}
      className={`flex w-[450px] max-w-full flex-col items-stretch space-y-4 rounded-md bg-white p-4 shadow-md ${className}`}
      {...props}
    >
      <h2 className="text-center text-2xl font-medium">
        Login with the Atmosphere
      </h2>
      <p>Enter your handle to continue</p>

      <AtmosphereSignInForm
        signIn={signIn}
        loading={loading}
        disabled={disabled}
        placeholder="@alice.example.com"
      />

      {signUpUrl && (
        <Button
          key="signup"
          type="button"
          loading={loading}
          disabled={disabled}
          size="large"
          action={() => signIn(signUpUrl)}
          name="signup-button"
        >
          Login or signup with {new URL(signUpUrl).host}
        </Button>
      )}
    </div>
  )
}
