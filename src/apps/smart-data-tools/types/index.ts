export interface DataTable {
  columns: string[]
  rows: Record<string, string>[]
}
export type DataFormat = 'csv' | 'json'
