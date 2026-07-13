import { describe, expect, it, vi } from 'vitest'
import { createDesktopPermissionService } from '@/windowFollower/desktopPermissionService'

describe('desktop permission service', () => {
  it('reads both macOS desktop permission gates', () => {
    const service = createDesktopPermissionService({
      platform: 'darwin',
      now: () => 1_000,
      isTrustedAccessibilityClient: vi.fn(() => true),
      getMediaAccessStatus: vi.fn(() => 'denied'),
      openExternal: vi.fn(async () => {})
    })

    expect(service.sample(true).value).toEqual({
      platform: 'macos',
      accessibility: 'granted',
      screenRecording: 'missing',
      checkedAt: 1_000
    })
  })

  it('marks both gates not applicable outside macOS', () => {
    const service = createDesktopPermissionService({
      platform: 'win32',
      now: () => 2_000,
      isTrustedAccessibilityClient: vi.fn(),
      getMediaAccessStatus: vi.fn(),
      openExternal: vi.fn(async () => {})
    })

    expect(service.sample().value).toEqual({
      platform: 'windows',
      accessibility: 'not-applicable',
      screenRecording: 'not-applicable',
      checkedAt: 2_000
    })
  })

  it('opens the requested macOS settings pane and forces a fresh sample', async () => {
    let granted = false
    const isTrustedAccessibilityClient = vi.fn((prompt: boolean) => {
      if (prompt) granted = true
      return granted
    })
    const openExternal = vi.fn(async () => {})
    const service = createDesktopPermissionService({
      platform: 'darwin',
      now: () => 3_000,
      isTrustedAccessibilityClient,
      getMediaAccessStatus: vi.fn(() => 'granted'),
      openExternal
    })

    expect(service.sample().value.accessibility).toBe('missing')
    const refreshed = await service.openSettings('accessibility')

    expect(openExternal).toHaveBeenCalledWith(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    )
    expect(isTrustedAccessibilityClient).toHaveBeenCalledWith(true)
    expect(refreshed.value.accessibility).toBe('granted')
  })
})
