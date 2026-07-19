import type { DataTable } from '../types'

export function parseCsv(input: string): DataTable {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < input.length; i += 1) {
    const c = input[i]
    const n = input[i + 1]
    if (c === '"') {
      if (quoted && n === '"') { cell += '"'; i += 1 }
      else quoted = !quoted
    } else if (c === ',' && !quoted) {
      row.push(cell); cell = ''
    } else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && n === '\n') i += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }

  const cleaned = rows.filter((r) => r.some((v) => v.trim()))
  if (!cleaned.length) return { columns: [], rows: [] }

  const columns = cleaned[0].map((h, i) => h.trim() || `Column ${i + 1}`)
  return {
    columns,
    rows: cleaned.slice(1).map((values) =>
      Object.fromEntries(columns.map((column, i) => [column, values[i] ?? '']))
    ),
  }
}

function escapeCsv(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function toCsv(table: DataTable): string {
  return [
    table.columns.map(escapeCsv).join(','),
    ...table.rows.map((row) =>
      table.columns.map((column) => escapeCsv(String(row[column] ?? ''))).join(',')
    ),
  ].join('\n')
}
