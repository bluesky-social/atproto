// @vitest-environment jsdom

import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import { act, createElement } from 'react'
import { type Root, createRoot } from 'react-dom/client'
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'
import { SecondAuthenticationFactorRequiredError } from '#/lib/api.ts'
import { type SignInData, SignInForm } from './sign-in-form.tsx'

describe('SignInForm second-factor authentication', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  function input(name: string) {
    const element = container.querySelector(`input[name="${name}"]`)
    assert(element instanceof HTMLInputElement)
    return element
  }

  function submitButton() {
    const element = container.querySelector('button[type="submit"]')
    assert(element instanceof HTMLButtonElement)
    return element
  }

  function setInputValue(name: string, value: string, dispatchInput = true) {
    const element = input(name)
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set
    assert(setter)
    setter.call(element, value)
    if (dispatchInput) {
      element.dispatchEvent(new Event('input', { bubbles: true }))
    }
  }

  async function prepareSecondFactor() {
    const submissions: SignInData[] = []
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } })

    await act(async () => {
      root.render(
        createElement(
          I18nProvider,
          { i18n },
          createElement(SignInForm, {
            usernameDefault: 'alice.test',
            onSignIn: async (data) => {
              submissions.push(data)
              if (!data.emailOtp) {
                throw new SecondAuthenticationFactorRequiredError({
                  error: 'second_authentication_factor_required',
                  type: 'emailOtp',
                  hint: 'a***e@e***t',
                })
              }
            },
          }),
        ),
      )
    })

    const form = container.querySelector('form')
    assert(form)
    await act(async () => {
      setInputValue('password', 'test-password')
      submitButton().focus()
      form.requestSubmit()
    })
    expect(submissions).toHaveLength(1)
    expect(input('otp').value).toBe('')
    await act(async () => setInputValue('otp', 'ABCDE-23456'))
    expect(input('otp').value).toBe('ABCDE-23456')

    return { form, submissions }
  }

  test.each(['username', 'password'])(
    'preserves the code when the unchanged %s field loses focus',
    async (field) => {
      const { form, submissions } = await prepareSecondFactor()

      await act(async () => input(field).focus())
      expect(document.activeElement).toBe(input(field))
      await act(async () => input('otp').focus())

      const remainingOtp = container.querySelector('input[name="otp"]')
      expect(
        remainingOtp,
        'MFA input must survive a focus-only change',
      ).not.toBeNull()
      assert(remainingOtp instanceof HTMLInputElement)
      expect(remainingOtp.value).toBe('ABCDE-23456')
      expect(submitButton().textContent).toBe('Confirm')

      await act(async () => form.requestSubmit())
      expect(submissions).toEqual([
        { username: 'alice.test', password: 'test-password', remember: false },
        {
          username: 'alice.test',
          password: 'test-password',
          remember: false,
          emailOtp: 'ABCDE-23456',
        },
      ])
    },
  )

  test.each(['username', 'password'])(
    'preserves the code when autofill supplies the same %s',
    async (field) => {
      await prepareSecondFactor()
      await act(async () => {
        input(field).focus()
        setInputValue(field, input(field).value)
      })
      await act(async () => input('otp').focus())

      expect(input('otp').value).toBe('ABCDE-23456')
      expect(submitButton().textContent).toBe('Confirm')
    },
  )

  test.each([
    ['username', 'bob.test', true],
    ['password', 'changed-password', true],
    ['username', 'bob.test', false],
    ['password', 'changed-password', false],
  ])(
    'resets the code when %s changes to %s (input event: %s)',
    async (field, value, dispatchInput) => {
      const { form, submissions } = await prepareSecondFactor()
      await act(async () => {
        input(field).focus()
        setInputValue(field, value, dispatchInput)
      })
      if (dispatchInput) {
        expect(container.querySelector('input[name="otp"]')).toBeNull()
      }
      await act(async () => submitButton().focus())

      expect(container.querySelector('input[name="otp"]')).toBeNull()
      expect(submitButton().textContent).toBe('Sign in')

      await act(async () => form.requestSubmit())
      expect(submissions).toHaveLength(2)
      expect(submissions[1]).toEqual({
        username: field === 'username' ? value : 'alice.test',
        password: field === 'password' ? value : 'test-password',
        remember: false,
      })
      expect(input('otp').value).toBe('')
    },
  )
})
