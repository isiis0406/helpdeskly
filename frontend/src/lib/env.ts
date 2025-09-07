export const CONTROL_API_URL =
  process.env.NEXT_PUBLIC_CONTROL_API_URL || 'http://localhost:6500'

// Global API prefix/version (e.g., '/api/v1')
export const CONTROL_API_PREFIX =
  process.env.NEXT_PUBLIC_CONTROL_API_PREFIX || '/api/v1'

// Build full Control API URL by prefixing version and normalizing slashes
export function buildControlApiUrl(path: string) {
  const base = CONTROL_API_URL.replace(/\/$/, '')
  const prefix = CONTROL_API_PREFIX.startsWith('/')
    ? CONTROL_API_PREFIX
    : `/${CONTROL_API_PREFIX}`
  const cleanPrefix = prefix.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPrefix}${cleanPath}`
}

// App API (tickets) base URL
export const APP_API_URL =
  process.env.NEXT_PUBLIC_APP_API_URL || 'http://localhost:6501'

// App API prefix
export const APP_API_PREFIX =
  process.env.NEXT_PUBLIC_APP_API_PREFIX || '/api/v1'

// Build App API URL
export function buildAppApiUrl(path: string) {
  const base = APP_API_URL.replace(/\/$/, '')
  const prefix = APP_API_PREFIX.startsWith('/') ? APP_API_PREFIX : `/${APP_API_PREFIX}`
  const cleanPrefix = prefix.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPrefix}${cleanPath}`
}
