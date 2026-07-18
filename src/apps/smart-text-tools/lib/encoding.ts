import type { EncodeMode } from '../types'

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToUtf8(value: string): string {
  const binary = atob(value.trim())
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function transformEncoding(text: string, mode: EncodeMode): string {
  switch (mode) {
    case 'base64-encode': return utf8ToBase64(text)
    case 'base64-decode': return base64ToUtf8(text)
    case 'url-encode': return encodeURIComponent(text)
    case 'url-decode': return decodeURIComponent(text)
  }
}
