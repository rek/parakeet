import * as Sentry from '@sentry/react-native'

export function captureException(error: unknown): void {
  if (error instanceof Error) {
    Sentry.captureException(error)
    return
  }

  if (typeof error === 'string') {
    Sentry.captureException(new Error(error))
    return
  }

  Sentry.captureException(JSON.stringify(error))
}
