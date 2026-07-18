import { useMemo, useState, type ChangeEvent } from 'react'
import type { DataFormat, DataTable } from './types'
import DataPreview from './components/DataPreview'
import { parseCsv, toCsv } from './lib/csv'
import {
  parseJson, removeDuplicates, removeEmptyRows, sortRows, filterRows,
  removeColumn, renameColumn, replaceValues,
} from './lib/data'
import { downloadText } from './lib/download'
import { trackSmartDataEvent } from './lib/analytics'
import './smart-data-tools.css'

const empty: DataTable = { columns: [], rows: [] }

export default function SmartDataToolsPage() {
  const [table, setTable] = useState<DataTable>(empty)
  const [source, setSource] = useState('')
  const [format, setFormat] = useState<DataFormat>('csv')
  const [message, setMessage] = useState('')
  const [column, setColumn] = useState('')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')
  const [query, setQuery] = useState('')
  const [newName, setNewName] = useState('')
  const [find, setFind] = useState('')
  const [replacement, setReplacement] = useState('')

  const stats = useMemo(() => {
    const keys = table.rows.map((row) => JSON.stringify(table.columns.map((c) => row[c] ?? '')))
    return {
      rows: table.rows.length,
      columns: table.columns.length,
      duplicates: keys.length - new Set(keys).size,
      emptyCells: table.rows.reduce(
        (sum, row) => sum + table.columns.filter((c) => !String(row[c] ?? '').trim()).length, 0
      ),
    }
  }, [table])

  const loadTable = (next: DataTable, label: string) => {
    setTable(next)
    setColumn(next.columns[0] ?? '')
    setMessage(label)
  }

  const parseSource = () => {
    try {
      loadTable(format === 'csv' ? parseCsv(source) : parseJson(source), 'Data loaded.')
      trackSmartDataEvent('data_loaded', { format })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not parse data.')
    }
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const text = await file.text()
    const nextFormat: DataFormat = file.name.toLowerCase().endsWith('.json') ? 'json' : 'csv'
    setSource(text)
    setFormat(nextFormat)
    try {
      loadTable(nextFormat === 'csv' ? parseCsv(text) : parseJson(text), `Loaded ${file.name}`)
      trackSmartDataEvent('data_loaded', { format: nextFormat })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not read file.')
    }
  }

  return (
    <main className="sdt-page">
      <section className="sdt-hero">
        <div>
          <span className="sdt-eyebrow">1 Hub Apps · App #005</span>
          <h1>Smart Data Tools</h1>
          <p>Clean, convert, filter and export CSV and JSON data directly in your browser.</p>
        </div>
        <div className="local-processing-badge">🔒 Local processing</div>
      </section>

      <section className="sdt-stats">
        <div><span>Rows</span><strong>{stats.rows}</strong></div>
        <div><span>Columns</span><strong>{stats.columns}</strong></div>
        <div><span>Duplicates</span><strong>{stats.duplicates}</strong></div>
        <div><span>Empty cells</span><strong>{stats.emptyCells}</strong></div>
      </section>

      <div className="sdt-grid">
        <section className="sdt-panel">
          <div className="sdt-heading"><span>Import</span><h2>Load data</h2></div>

          <label className="sdt-upload">
            <strong>Upload CSV or JSON</strong>
            <span>Processed locally in your browser</span>
            <input type="file" accept=".csv,.json,text/csv,application/json" onChange={onFile} />
          </label>

          <label>Input format
            <select value={format} onChange={(e) => setFormat(e.target.value as DataFormat)}>
              <option value="csv">CSV</option>
              <option value="json">JSON array</option>
            </select>
          </label>

          <textarea
            className="sdt-source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={format === 'csv' ? 'name,email\nPraveen,test@example.com' : '[{"name":"Praveen"}]'}
          />

          <button className="sdt-primary" type="button" onClick={parseSource}>Load data</button>
          {message && <div className="sdt-message">{message}</div>}
        </section>

        <section className="sdt-panel">
          <div className="sdt-heading"><span>Transform</span><h2>Clean & modify</h2></div>

          <div className="sdt-actions">
            <button disabled={!table.rows.length} onClick={() => loadTable(removeDuplicates(table), 'Duplicates removed.')}>Remove duplicates</button>
            <button disabled={!table.rows.length} onClick={() => loadTable(removeEmptyRows(table), 'Empty rows removed.')}>Remove empty rows</button>
          </div>

          <label>Column
            <select value={column} onChange={(e) => setColumn(e.target.value)}>
              {table.columns.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>

          <div className="sdt-two">
            <label>Sort
              <select value={direction} onChange={(e) => setDirection(e.target.value as 'asc' | 'desc')}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </label>
            <button disabled={!column} onClick={() => loadTable(sortRows(table, column, direction), 'Rows sorted.')}>Sort rows</button>
          </div>

          <div className="sdt-two">
            <label>Filter contains<input value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <button disabled={!column} onClick={() => loadTable(filterRows(table, column, query), 'Filter applied.')}>Apply filter</button>
          </div>

          <div className="sdt-two">
            <label>New column name<input value={newName} onChange={(e) => setNewName(e.target.value)} /></label>
            <button disabled={!column || !newName.trim()} onClick={() => {
              try { loadTable(renameColumn(table, column, newName), 'Column renamed.'); setNewName('') }
              catch (e) { setMessage(e instanceof Error ? e.message : 'Rename failed.') }
            }}>Rename column</button>
          </div>

          <div className="sdt-two">
            <label>Find<input value={find} onChange={(e) => setFind(e.target.value)} /></label>
            <label>Replace with<input value={replacement} onChange={(e) => setReplacement(e.target.value)} /></label>
          </div>
          <button disabled={!column || !find} onClick={() => loadTable(replaceValues(table, column, find, replacement), 'Values replaced.')}>Find & replace</button>

          <button disabled={!column} onClick={() => loadTable(removeColumn(table, column), 'Column removed.')}>Remove selected column</button>
        </section>
      </div>

      <section className="sdt-panel sdt-preview">
        <div className="sdt-preview-head">
          <div className="sdt-heading"><span>Preview</span><h2>Data table</h2></div>
          <div className="sdt-actions">
            <button className="sdt-primary" disabled={!table.columns.length} onClick={() => downloadText(toCsv(table), 'data-export.csv', 'text/csv;charset=utf-8')}>Export CSV</button>
            <button disabled={!table.columns.length} onClick={() => downloadText(JSON.stringify(table.rows, null, 2), 'data-export.json', 'application/json;charset=utf-8')}>Export JSON</button>
          </div>
        </div>
        <DataPreview table={table} />
      </section>
    </main>
  )
}
