import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildApiUrl, resetApiProxyAvailabilityCache, resolveApiProxyAvailability, resolveApiProxyCapabilities } from './devProxy'

afterEach(() => {
  resetApiProxyAvailabilityCache()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('buildApiUrl', () => {
  it('uses the same-origin proxy prefix when API proxy is enabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'images/edits', null, true)).toBe(
      '/api-proxy/images/edits',
    )
  })

  it('keeps the v1 segment when the configured API URL does not include it', () => {
    expect(buildApiUrl('http://api.example.com', 'images/generations', null, true)).toBe(
      '/api-proxy/v1/images/generations',
    )
  })

  it('uses a configured proxy prefix when one is available', () => {
    expect(
      buildApiUrl(
        'http://api.example.com/v1',
        'responses',
        {
          enabled: true,
          prefix: '/openai-proxy',
          target: 'http://api.example.com/v1',
          changeOrigin: true,
          secure: false,
        },
        true,
      ),
    ).toBe('/openai-proxy/responses')
  })

  it('uses the configured API URL directly when API proxy is disabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'responses', null, false)).toBe(
      'http://api.example.com/v1/responses',
    )
  })

  it('probes the runtime capability endpoint when no static proxy flag is present', async () => {
    vi.stubEnv('VITE_API_PROXY_AVAILABLE', 'false')
    vi.stubGlobal('window', { location: { protocol: 'https:' } })
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ available: true, dynamicTarget: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(resolveApiProxyCapabilities(null)).resolves.toEqual({
      available: true,
      dynamicTarget: false,
    })
    await expect(resolveApiProxyAvailability(null)).resolves.toBe(true)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api-proxy/__capabilities',
      expect.objectContaining({ method: 'GET' }),
    )
  })
})
