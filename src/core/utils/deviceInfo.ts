// Lightweight, dependency-free device/browser detection for analytics.
// Not exhaustive — good enough for aggregate stats without pulling in a UA-parser lib.

export interface DeviceInfo {
  device: 'mobile' | 'tablet' | 'desktop'
  browser: string
  os: string
}

export function getDeviceInfo(): DeviceInfo {
  const ua = navigator.userAgent

  let device: DeviceInfo['device'] = 'desktop'
  if (/tablet|ipad/i.test(ua)) device = 'tablet'
  else if (/mobile|iphone|android/i.test(ua)) device = 'mobile'

  let browser = 'Unknown'
  if (ua.includes('Edg/')) browser = 'Edge'
  else if (ua.includes('Chrome/')) browser = 'Chrome'
  else if (ua.includes('Firefox/')) browser = 'Firefox'
  else if (ua.includes('Safari/')) browser = 'Safari'

  let os = 'Unknown'
  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac OS')) os = 'macOS'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS'
  else if (ua.includes('Linux')) os = 'Linux'

  return { device, browser, os }
}

export function getOrCreateVisitorId(): { id: string; isReturning: boolean } {
  const key = 'hub_apps_visitor_id'
  const existing = localStorage.getItem(key)
  if (existing) return { id: existing, isReturning: true }
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return { id, isReturning: false }
}
