export interface DevProxyConfig {
  enabled: boolean
  prefix: string
  target: string
  changeOrigin: boolean
  secure: boolean
}

export interface ApiProxyCapabilities {
  available: boolean
  dynamicTarget: boolean
}

const DEFAULT_PROXY_PREFIX = '/api-proxy'
const API_PROXY_CAPABILITIES_PATH = `${DEFAULT_PROXY_PREFIX}/__capabilities`

const UNAVAILABLE_PROXY_CAPABILITIES: ApiProxyCapabilities = {
  available: false,
  dynamicTarget: false,
}

let runtimeApiProxyCapabilitiesPromise: Promise<ApiProxyCapabilities> | null = null

export const API_PROXY_TARGET_HEADER = 'X-Api-Proxy-Target'

export function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  if (!trimmed) return ''

  const input = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(input)
    const pathSegments = url.pathname.split('/').filter(Boolean)
    const v1Index = pathSegments.indexOf('v1')
    const normalizedSegments = v1Index >= 0
      ? pathSegments.slice(0, v1Index + 1)
      : pathSegments.length
        ? [...pathSegments, 'v1']
        : []
    const pathname = normalizedSegments.length ? `/${normalizedSegments.join('/')}` : ''
    return `${url.origin}${pathname}`
  } catch {
    return trimmed.replace(/\/+$/, '')
  }
}

export function normalizeDevProxyConfig(input: unknown): DevProxyConfig | null {
  if (!input || typeof input !== 'object') return null

  const record = input as Record<string, unknown>
  const target = normalizeBaseUrl(typeof record.target === 'string' ? record.target : '')
  if (!target) return null

  const rawPrefix = typeof record.prefix === 'string' ? record.prefix : DEFAULT_PROXY_PREFIX
  const trimmedPrefix = rawPrefix.trim().replace(/^\/+/, '').replace(/\/+$/, '')
  const prefix = trimmedPrefix ? `/${trimmedPrefix}` : DEFAULT_PROXY_PREFIX

  return {
    enabled: Boolean(record.enabled),
    prefix,
    target,
    changeOrigin: record.changeOrigin !== false,
    secure: Boolean(record.secure),
  }
}

export function buildApiUrl(
  baseUrl: string,
  path: string,
  proxyConfig?: DevProxyConfig | null,
  useApiProxy = false,
): string {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)
  const endpointPath = path.replace(/^\/+/, '')
  const apiPath = normalizedBaseUrl.endsWith('/v1')
    ? endpointPath
    : ['v1', endpointPath].join('/')

  if (useApiProxy) {
    return `${proxyConfig?.prefix ?? DEFAULT_PROXY_PREFIX}/${apiPath}`
  }

  return normalizedBaseUrl ? `${normalizedBaseUrl}/${apiPath}` : `/${apiPath}`
}

export function resolveDevProxyConfig(input: unknown, isDev: boolean): DevProxyConfig | null {
  if (!isDev) return null
  return normalizeDevProxyConfig(input)
}

export function readClientDevProxyConfig(): DevProxyConfig | null {
  return resolveDevProxyConfig(
    typeof __DEV_PROXY_CONFIG__ === 'undefined' ? null : __DEV_PROXY_CONFIG__,
    import.meta.env.DEV,
  )
}

export function isApiProxyAvailable(proxyConfig: DevProxyConfig | null = readClientDevProxyConfig()): boolean {
  return import.meta.env.VITE_API_PROXY_AVAILABLE === 'true' || Boolean(proxyConfig?.enabled)
}

function canProbeRuntimeApiProxy() {
  return typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol)
}

function getStaticApiProxyCapabilities(proxyConfig: DevProxyConfig | null): ApiProxyCapabilities {
  if (proxyConfig?.enabled) {
    return {
      available: true,
      dynamicTarget: false,
    }
  }

  if (import.meta.env.VITE_API_PROXY_AVAILABLE === 'true') {
    return {
      available: true,
      dynamicTarget: false,
    }
  }

  return UNAVAILABLE_PROXY_CAPABILITIES
}

function normalizeApiProxyCapabilities(input: unknown): ApiProxyCapabilities {
  if (!input || typeof input !== 'object') return UNAVAILABLE_PROXY_CAPABILITIES

  const record = input as Record<string, unknown>
  return {
    available: record.available !== false,
    dynamicTarget: Boolean(record.dynamicTarget),
  }
}

export async function resolveApiProxyCapabilities(
  proxyConfig: DevProxyConfig | null = readClientDevProxyConfig(),
): Promise<ApiProxyCapabilities> {
  const staticCapabilities = getStaticApiProxyCapabilities(proxyConfig)
  if (!canProbeRuntimeApiProxy()) return staticCapabilities

  if (!runtimeApiProxyCapabilitiesPromise) {
    runtimeApiProxyCapabilitiesPromise = fetch(API_PROXY_CAPABILITIES_PATH, {
      method: 'GET',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return staticCapabilities

        try {
          return normalizeApiProxyCapabilities(await response.json())
        } catch {
          return staticCapabilities
        }
      })
      .catch(() => staticCapabilities)
  }

  return runtimeApiProxyCapabilitiesPromise
}

export async function resolveApiProxyAvailability(
  proxyConfig: DevProxyConfig | null = readClientDevProxyConfig(),
): Promise<boolean> {
  return (await resolveApiProxyCapabilities(proxyConfig)).available
}

export function resetApiProxyAvailabilityCache() {
  runtimeApiProxyCapabilitiesPromise = null
}
