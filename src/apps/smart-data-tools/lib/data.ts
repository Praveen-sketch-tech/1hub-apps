import type { DataTable } from '../types'

export function parseJson(input: string): DataTable {
  const parsed: unknown = JSON.parse(input)
  if (!Array.isArray(parsed)) throw new Error('JSON must be an array of objects.')
  const rows = parsed as Record<string, unknown>[]
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row ?? {}))))
  return {
    columns,
    rows: rows.map((row) =>
      Object.fromEntries(columns.map((column) => [
        column,
        row?.[column] == null ? '' : typeof row[column] === 'object'
          ? JSON.stringify(row[column])
          : String(row[column]),
      ]))
    ),
  }
}

export function removeDuplicates(table: DataTable): DataTable {
  const seen = new Set<string>()
  return {
    ...table,
    rows: table.rows.filter((row) => {
      const key = JSON.stringify(table.columns.map((c) => row[c] ?? ''))
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  }
}

export function removeEmptyRows(table: DataTable): DataTable {
  return {
    ...table,
    rows: table.rows.filter((row) =>
      table.columns.some((c) => String(row[c] ?? '').trim())
    ),
  }
}

export function sortRows(table: DataTable, column: string, direction: 'asc' | 'desc'): DataTable {
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  return {
    ...table,
    rows: [...table.rows].sort((a, b) => {
      const result = collator.compare(String(a[column] ?? ''), String(b[column] ?? ''))
      return direction === 'asc' ? result : -result
    }),
  }
}

export function filterRows(table: DataTable, column: string, query: string): DataTable {
  if (!query.trim()) return table
  const q = query.toLowerCase()
  return {
    ...table,
    rows: table.rows.filter((row) =>
      String(row[column] ?? '').toLowerCase().includes(q)
    ),
  }
}

export function removeColumn(table: DataTable, column: string): DataTable {
  return {
    columns: table.columns.filter((c) => c !== column),
    rows: table.rows.map((row) => {
      const next = { ...row }
      delete next[column]
      return next
    }),
  }
}

export function renameColumn(table: DataTable, from: string, to: string): DataTable {
  const name = to.trim()
  if (!name) throw new Error('New column name is required.')
  if (from !== name && table.columns.includes(name)) throw new Error('Column name already exists.')
  return {
    columns: table.columns.map((c) => c === from ? name : c),
    rows: table.rows.map((row) =>
      Object.fromEntries(table.columns.map((c) => [c === from ? name : c, row[c] ?? '']))
    ),
  }
}

export function replaceValues(
  table: DataTable,
  column: string,
  find: string,
  replacement: string,
): DataTable {
  if (!find) return table
  return {
    ...table,
    rows: table.rows.map((row) => ({
      ...row,
      [column]: String(row[column] ?? '').split(find).join(replacement),
    })),
  }
}
