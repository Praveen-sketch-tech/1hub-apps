export interface PasswordOptions {
  length: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const NUMBERS = '0123456789'
const SYMBOLS = '!@#$%^&*()_+-=[]{};:,.<>?'

function secureRandomInt(max: number): number {
  if (max <= 0) {
    throw new Error('Random range must be greater than zero.')
  }

  const limit = Math.floor(0x100000000 / max) * max
  const buffer = new Uint32Array(1)

  while (true) {
    crypto.getRandomValues(buffer)
    const value = buffer[0]

    if (value < limit) {
      return value % max
    }
  }
}

function pick(chars: string): string {
  return chars[secureRandomInt(chars.length)]
}

export function generatePassword(options: PasswordOptions): string {
  const length = Math.max(4, Math.min(128, Math.round(options.length)))

  const groups = [
    options.lowercase ? LOWER : '',
    options.uppercase ? UPPER : '',
    options.numbers ? NUMBERS : '',
    options.symbols ? SYMBOLS : '',
  ].filter(Boolean)

  if (!groups.length) {
    throw new Error('Select at least one character type.')
  }

  const all = groups.join('')
  const chars: string[] = []

  // Guarantee at least one character from every enabled group.
  for (const group of groups) {
    chars.push(pick(group))
  }

  while (chars.length < length) {
    chars.push(pick(all))
  }

  // Secure Fisher-Yates shuffle.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1)
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }

  return chars.slice(0, length).join('')
}

export function estimatePasswordStrength(password: string): {
  label: 'Weak' | 'Fair' | 'Good' | 'Strong'
  score: number
} {
  let score = 0

  if (password.length >= 8) score += 1
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  if (/\d/.test(password)) score += 1
  if (/[^A-Za-z0-9]/.test(password)) score += 1
  if (password.length >= 20) score += 1

  if (score <= 2) return { label: 'Weak', score: 25 }
  if (score === 3) return { label: 'Fair', score: 50 }
  if (score === 4) return { label: 'Good', score: 75 }
  return { label: 'Strong', score: 100 }
}

export function parsePasswordLength(input: string, fallback = 20): number {
  const matches = [...input.matchAll(/\b(\d{1,3})\b/g)]
  const value = matches.length ? Number(matches[0][1]) : fallback
  return Math.max(4, Math.min(128, value))
}
