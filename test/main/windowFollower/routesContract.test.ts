import { describe, expect, it } from 'vitest'
import { DEEPCHAT_ROUTE_CATALOG } from '@shared/contracts/routes'
import { DEEPCHAT_EVENT_CATALOG } from '@shared/contracts/events'
import {
  windowFollowerGetStateRoute,
  windowFollowerOpenPermissionSettingsRoute,
  windowFollowerSetModeRoute
} from '@shared/contracts/routes/windowFollower.routes'

describe('window follower typed routes', () => {
  it('registers all WindowFollower routes in the DeepChat catalog', () => {
    expect(Object.keys(DEEPCHAT_ROUTE_CATALOG)).toEqual(
      expect.arrayContaining([
        'windowFollower.getState',
        'windowFollower.refresh',
        'windowFollower.setMode',
        'windowFollower.setCollapsed',
        'windowFollower.setWidth',
        'windowFollower.setPointerInteractive',
        'windowFollower.setAutomaticAdhesion',
        'windowFollower.openPermissionSettings',
        'windowFollower.resetWidth',
        'windowFollower.getSettings',
        'windowFollower.excludeCurrentApp',
        'windowFollower.removeExcludedApp',
        'windowFollower.hide',
        'windowFollower.quit'
      ])
    )
  })

  it('rejects unknown route input fields', () => {
    expect(() => windowFollowerGetStateRoute.input.parse({ secret: true })).toThrow()
    expect(() => windowFollowerSetModeRoute.input.parse({ mode: 'fixed', extra: 1 })).toThrow()
  })

  it('accepts only the two macOS permission setting targets', () => {
    expect(
      windowFollowerOpenPermissionSettingsRoute.input.parse({ permission: 'accessibility' })
    ).toEqual({ permission: 'accessibility' })
    expect(() =>
      windowFollowerOpenPermissionSettingsRoute.input.parse({ permission: 'camera' })
    ).toThrow()
  })

  it('registers a typed state-change event for renderer subscriptions', () => {
    expect(DEEPCHAT_EVENT_CATALOG).toHaveProperty('windowFollower.stateChanged')
  })
})
