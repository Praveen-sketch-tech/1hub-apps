export function formatJson(input: string, spaces = 2): string {
  return JSON.stringify(JSON.parse(input), null, spaces)
}

export function minifyJson(input: string): string {
  return JSON.stringify(JSON.parse(input))
}

export function validateJson(input: string): { valid: boolean; message: string } {
  try {
    JSON.parse(input)
    return { valid: true, message: 'Valid JSON' }
  } catch (cause) {
    return { valid: false, message: cause instanceof Error ? cause.message : 'Invalid JSON' }
  }
}
