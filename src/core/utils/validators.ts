export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isValidMobile(mobile: string): boolean {
  return /^[+]?[0-9\s-]{7,15}$/.test(mobile)
}

export function isStrongPassword(password: string): boolean {
  // At least 8 chars, one letter, one number
  return password.length >= 8 && /[A-Za-z]/.test(password) && /[0-9]/.test(password)
}

export function passwordStrengthLabel(password: string): 'weak' | 'medium' | 'strong' {
  if (password.length < 8) return 'weak'
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)
  const score = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length
  if (score >= 2 && password.length >= 12) return 'strong'
  if (score >= 1) return 'medium'
  return 'weak'
}
