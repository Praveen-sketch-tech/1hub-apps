import type { DataTable } from '../types'

export default function DataPreview({ table }: { table: DataTable }) {
  if (!table.columns.length) return <div className="sdt-empty">Load CSV or JSON to preview data.</div>

  return (
    <div className="sdt-table-wrap">
      <table className="sdt-table">
        <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {table.rows.slice(0, 100).map((row, index) => (
            <tr key={index}>
              {table.columns.map((c) => <td key={c}>{row[c]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 100 && <div className="sdt-note">Showing first 100 of {table.rows.length} rows.</div>}
    </div>
  )
}
