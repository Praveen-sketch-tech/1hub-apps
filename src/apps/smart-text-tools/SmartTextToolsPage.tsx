import { useMemo, useState } from 'react'
import ToolTabs from './components/ToolTabs'
import TextStatsBar from './components/TextStatsBar'
import ComparePanel from './components/ComparePanel'
import JsonPanel from './components/JsonPanel'
import type { CaseMode, EncodeMode, ExtractMode, TextTool } from './types'
import {
  addPrefixSuffix,
  cleanText,
  convertCase,
  extractValues,
  findAndReplace,
  getTextStats,
  removeDuplicateLines,
  sortLines,
} from './lib/textTransforms'
import { transformEncoding } from './lib/encoding'
import { downloadText } from './lib/download'
import { SMART_TEXT_EVENTS, trackSmartTextEvent } from './lib/analytics'
import './smart-text-tools.css'
import { connectSmartTextToolsAnalytics } from './lib/analyticsBridge'
import { ToolAppHeader } from '@shared/components/tools/ToolAppHeader'

connectSmartTextToolsAnalytics()

export default function SmartTextToolsPage() {
  const [tool, setTool] = useState<TextTool>('clean')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [status, setStatus] = useState('')
  const [fileName, setFileName] = useState('text-output.txt')
  const [cleanOptions, setCleanOptions] = useState({
    trimLines: true,
    removeExtraSpaces: true,
    removeBlankLines: false,
    normalizeLineBreaks: true,
    removeHtml: false,
  })
  const [caseMode, setCaseMode] = useState<CaseMode>('uppercase')
  const [duplicateCaseSensitive, setDuplicateCaseSensitive] = useState(false)
  const [keepEmpty, setKeepEmpty] = useState(false)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [sortNumeric, setSortNumeric] = useState(true)
  const [sortCaseSensitive, setSortCaseSensitive] = useState(false)
  const [findValue, setFindValue] = useState('')
  const [replaceValue, setReplaceValue] = useState('')
  const [findCaseSensitive, setFindCaseSensitive] = useState(false)
  const [wholeWord, setWholeWord] = useState(false)
  const [prefix, setPrefix] = useState('')
  const [suffix, setSuffix] = useState('')
  const [skipEmpty, setSkipEmpty] = useState(true)
  const [extractMode, setExtractMode] = useState<ExtractMode>('emails')
  const [encodeMode, setEncodeMode] = useState<EncodeMode>('base64-encode')

  const stats = useMemo(() => getTextStats(input), [input])

  const runTool = () => {
    try {
      setStatus('')
      let result = ''

      switch (tool) {
        case 'clean':
          result = cleanText(input, cleanOptions)
          trackSmartTextEvent(SMART_TEXT_EVENTS.TEXT_CLEANED)
          break
        case 'case':
          result = convertCase(input, caseMode)
          trackSmartTextEvent(SMART_TEXT_EVENTS.CASE_CONVERTED, { mode: caseMode })
          break
        case 'duplicates':
          result = removeDuplicateLines(input, {
            caseSensitive: duplicateCaseSensitive,
            keepEmpty,
          })
          trackSmartTextEvent(SMART_TEXT_EVENTS.DUPLICATES_REMOVED)
          break
        case 'sort':
          result = sortLines(input, sortDirection, {
            numeric: sortNumeric,
            caseSensitive: sortCaseSensitive,
          })
          trackSmartTextEvent(SMART_TEXT_EVENTS.LINES_SORTED, { direction: sortDirection })
          break
        case 'find-replace': {
          const replaced = findAndReplace(input, findValue, replaceValue, {
            caseSensitive: findCaseSensitive,
            wholeWord,
          })
          result = replaced.result
          setStatus(`${replaced.count} replacement${replaced.count === 1 ? '' : 's'}`)
          trackSmartTextEvent(SMART_TEXT_EVENTS.FIND_REPLACE_USED, { count: replaced.count })
          break
        }
        case 'prefix-suffix':
          result = addPrefixSuffix(input, prefix, suffix, skipEmpty)
          trackSmartTextEvent(SMART_TEXT_EVENTS.PREFIX_SUFFIX_USED)
          break
        case 'extract': {
          const values = extractValues(input, extractMode)
          result = values.join('\n')
          setStatus(`${values.length} unique result${values.length === 1 ? '' : 's'} found`)
          trackSmartTextEvent(SMART_TEXT_EVENTS.VALUES_EXTRACTED, {
            mode: extractMode,
            count: values.length,
          })
          break
        }
        case 'encode':
          result = transformEncoding(input, encodeMode)
          trackSmartTextEvent(SMART_TEXT_EVENTS.ENCODING_USED, { mode: encodeMode })
          break
        case 'json':
        case 'compare':
          return
      }

      setOutput(result)
    } catch (cause) {
      setStatus(cause instanceof Error ? cause.message : 'Could not process this text.')
    }
  }

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output)
      setStatus('Copied to clipboard')
      trackSmartTextEvent(SMART_TEXT_EVENTS.OUTPUT_COPIED)
    } catch {
      setStatus('Clipboard access is unavailable. Select and copy the text manually.')
    }
  }

  return (
    <main className="stt-page">
      <ToolAppHeader
        appNumber="004"
        title="Smart Text Tools"
        description="Clean, convert, compare, extract and format text instantly in your browser."
      />

      <TextStatsBar stats={stats} />
      <ToolTabs value={tool} onChange={(nextTool) => {
        setTool(nextTool)
        setStatus('')
      }} />

      {tool === 'compare' ? (
        <section className="stt-panel">
          <div className="stt-panel-heading">
            <span>Compare</span>
            <h2>Compare two text versions line by line</h2>
          </div>
          <ComparePanel />
        </section>
      ) : (
        <div className="stt-workspace">
          <section className="stt-panel">
            <div className="stt-panel-heading">
              <span>Input</span>
              <h2>Paste or type your text</h2>
            </div>

            <textarea
              className="stt-main-textarea"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Paste text here…"
            />

            <div className="stt-tool-options">
              {tool === 'clean' && (
                <div className="stt-checkbox-grid">
                  {[
                    ['trimLines', 'Trim each line'],
                    ['removeExtraSpaces', 'Remove extra spaces'],
                    ['removeBlankLines', 'Remove blank lines'],
                    ['normalizeLineBreaks', 'Normalize line breaks'],
                    ['removeHtml', 'Remove HTML tags'],
                  ].map(([key, label]) => (
                    <label className="stt-checkbox" key={key}>
                      <input
                        type="checkbox"
                        checked={cleanOptions[key as keyof typeof cleanOptions]}
                        onChange={(event) =>
                          setCleanOptions((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }))
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
              )}

              {tool === 'case' && (
                <label>
                  Convert to
                  <select value={caseMode} onChange={(event) => setCaseMode(event.target.value as CaseMode)}>
                    <option value="uppercase">UPPERCASE</option>
                    <option value="lowercase">lowercase</option>
                    <option value="title">Title Case</option>
                    <option value="sentence">Sentence case</option>
                    <option value="camel">camelCase</option>
                    <option value="kebab">kebab-case</option>
                    <option value="snake">snake_case</option>
                  </select>
                </label>
              )}

              {tool === 'duplicates' && (
                <div className="stt-checkbox-grid">
                  <label className="stt-checkbox"><input type="checkbox" checked={duplicateCaseSensitive} onChange={(e) => setDuplicateCaseSensitive(e.target.checked)} /> Case-sensitive</label>
                  <label className="stt-checkbox"><input type="checkbox" checked={keepEmpty} onChange={(e) => setKeepEmpty(e.target.checked)} /> Keep empty lines</label>
                </div>
              )}

              {tool === 'sort' && (
                <div className="stt-form-grid">
                  <label>Direction<select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}><option value="asc">A → Z</option><option value="desc">Z → A</option></select></label>
                  <label className="stt-checkbox"><input type="checkbox" checked={sortNumeric} onChange={(e) => setSortNumeric(e.target.checked)} /> Numeric sort</label>
                  <label className="stt-checkbox"><input type="checkbox" checked={sortCaseSensitive} onChange={(e) => setSortCaseSensitive(e.target.checked)} /> Case-sensitive</label>
                </div>
              )}

              {tool === 'find-replace' && (
                <>
                  <div className="stt-form-grid stt-form-grid--2">
                    <label>Find<input value={findValue} onChange={(e) => setFindValue(e.target.value)} /></label>
                    <label>Replace with<input value={replaceValue} onChange={(e) => setReplaceValue(e.target.value)} /></label>
                  </div>
                  <div className="stt-checkbox-grid">
                    <label className="stt-checkbox"><input type="checkbox" checked={findCaseSensitive} onChange={(e) => setFindCaseSensitive(e.target.checked)} /> Case-sensitive</label>
                    <label className="stt-checkbox"><input type="checkbox" checked={wholeWord} onChange={(e) => setWholeWord(e.target.checked)} /> Whole word only</label>
                  </div>
                </>
              )}

              {tool === 'prefix-suffix' && (
                <div className="stt-form-grid stt-form-grid--2">
                  <label>Prefix<input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="+91" /></label>
                  <label>Suffix<input value={suffix} onChange={(e) => setSuffix(e.target.value)} /></label>
                  <label className="stt-checkbox"><input type="checkbox" checked={skipEmpty} onChange={(e) => setSkipEmpty(e.target.checked)} /> Skip empty lines</label>
                </div>
              )}

              {tool === 'extract' && (
                <label>
                  Extract
                  <select value={extractMode} onChange={(e) => setExtractMode(e.target.value as ExtractMode)}>
                    <option value="emails">Email addresses</option>
                    <option value="urls">URLs</option>
                    <option value="numbers">Phone-like numbers</option>
                  </select>
                </label>
              )}

              {tool === 'encode' && (
                <label>
                  Operation
                  <select value={encodeMode} onChange={(e) => setEncodeMode(e.target.value as EncodeMode)}>
                    <option value="base64-encode">Base64 Encode</option>
                    <option value="base64-decode">Base64 Decode</option>
                    <option value="url-encode">URL Encode</option>
                    <option value="url-decode">URL Decode</option>
                  </select>
                </label>
              )}

              {tool === 'json' ? (
                <JsonPanel input={input} onOutput={setOutput} />
              ) : (
                <button className="stt-primary-button" type="button" onClick={runTool}>
                  Process text
                </button>
              )}

              {status && <div className="stt-status">{status}</div>}
            </div>
          </section>

          <section className="stt-panel stt-output-panel">
            <div className="stt-panel-heading">
              <span>Output</span>
              <h2>Processed result</h2>
            </div>

            <textarea
              className="stt-main-textarea"
              value={output}
              onChange={(event) => setOutput(event.target.value)}
              placeholder="Your processed text will appear here…"
            />

            <div className="stt-actions">
              <button className="stt-primary-button" type="button" disabled={!output} onClick={copyOutput}>
                Copy output
              </button>
              <button
                className="stt-secondary-button"
                type="button"
                disabled={!output}
                onClick={() => {
                  downloadText(output, fileName)
                  trackSmartTextEvent(SMART_TEXT_EVENTS.OUTPUT_DOWNLOADED)
                }}
              >
                Download TXT
              </button>
              <button
                className="stt-secondary-button"
                type="button"
                onClick={() => {
                  setInput(output)
                  setOutput('')
                  setStatus('Output moved to input')
                }}
                disabled={!output}
              >
                Use as input
              </button>
            </div>

            <label>
              Download file name
              <input value={fileName} onChange={(event) => setFileName(event.target.value)} />
            </label>
          </section>
        </div>
      )}
    </main>
  )
}
