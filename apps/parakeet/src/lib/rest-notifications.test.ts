import { describe, expect, it } from 'vitest'
import { buildRestNotificationContent } from './rest-notification-helpers'

describe('buildRestNotificationContent', () => {
  it('builds correct title and body for squat heavy', () => {
    expect(buildRestNotificationContent('squat', 'heavy')).toEqual({
      title: 'Rest done',
      body: 'Squat — Heavy is ready',
    })
  })

  it('builds correct body for deadlift rep', () => {
    expect(buildRestNotificationContent('deadlift', 'rep')).toEqual({
      title: 'Rest done',
      body: 'Deadlift — Rep is ready',
    })
  })

  it('capitalizes single-word lift and intensity', () => {
    expect(buildRestNotificationContent('bench', 'deload')).toEqual({
      title: 'Rest done',
      body: 'Bench — Deload is ready',
    })
  })

  it('handles explosive intensity', () => {
    expect(buildRestNotificationContent('squat', 'explosive')).toEqual({
      title: 'Rest done',
      body: 'Squat — Explosive is ready',
    })
  })
})
