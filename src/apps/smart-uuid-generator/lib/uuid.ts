export function generateUuid(): string {
  return crypto.randomUUID()
}

export function generateUuids(count: number): string[] {
  const safeCount = Math.max(1, Math.min(100, Math.floor(count)))
  return Array.from({ length: safeCount }, generateUuid)
}

export function parseUuidCount(input: string, fallback = 1): number {
  const match = input.match(/\b(\d{1,3})\b/)
  if (!match) return fallback
  return Math.max(1, Math.min(100, Number(match[1])))
}
