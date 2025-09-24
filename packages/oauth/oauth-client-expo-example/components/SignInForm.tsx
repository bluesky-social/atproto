import { useCallback, useEffect, useState } from 'react'
import { Button, Text, TextInput, View } from 'react-native'

export function SignInForm({
  signIn,
  disabled = !signIn,
}: {
  signIn?: (input: string) => Promise<void>
  disabled?: boolean
}) {
  const [input, setInput] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setError(null), [input])

  const fixedInput = fixInput(input)

  const doSignIn = useCallback(
    async (input: string | null) => {
      if (disabled || !signIn || !input) return
      try {
        setError(null)
        await signIn(input)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    },
    [disabled, signIn],
  )

  return (
    <View
      style={{
        flex: 1,
        gap: 10,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text>Enter your AT handle:</Text>
      <TextInput
        value={input}
        onChangeText={setInput}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        editable={!disabled}
        placeholder='e.g. "alice.bsky.social"'
        submitBehavior="blurAndSubmit"
        onSubmitEditing={() => doSignIn(fixedInput)}
      />
      <Button
        title="Sign in"
        disabled={disabled}
        onPress={() => doSignIn(fixedInput)}
      />
      <Button
        title="Sign up on Bluesky"
        disabled={disabled}
        onPress={() => doSignIn('https://bsky.social')}
      />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
    </View>
  )
}

function fixInput(input: string) {
  const trimmed = input.replaceAll(' ', '')
  if (trimmed.length < 3) return null // definitely invalid
  if (!trimmed.includes('.')) return null // definitely invalid
  return trimmed
}
