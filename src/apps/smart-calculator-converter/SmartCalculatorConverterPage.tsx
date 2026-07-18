import { useMemo, useState } from 'react'
import { calculateEmi, estimateScenarios, monthsBetween } from './lib/finance'
import { convertValue, getUnits, type ConverterType } from './lib/converters'
import './smart-calculator-converter.css'

type Tab = 'basic' | 'loan' | 'gst' | 'percentage' | 'date' | 'converter'

function money(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)
}

function safeCalc(expression: string): number | null {
  if (!/^[0-9+\-*/().%\s]+$/.test(expression)) return null
  try {
    const value = Function(`"use strict";return (${expression.replace(/%/g,'/100')})`)()
    return typeof value === 'number' && Number.isFinite(value) ? value : null
  } catch { return null }
}

export default function SmartCalculatorConverterPage() {
  const [tab, setTab] = useState<Tab>('basic')
  const [expression, setExpression] = useState('1000 * 12 / 100')

  const [loanMode, setLoanMode] = useState<'standard'|'existing'>('standard')
  const [principal, setPrincipal] = useState(500000)
  const [rate, setRate] = useState(12)
  const [tenure, setTenure] = useState(60)

  const [origLoan, setOrigLoan] = useState(500000)
  const [currentBal, setCurrentBal] = useState(350000)
  const [startDate, setStartDate] = useState('')
  const [paidMonths, setPaidMonths] = useState(12)

  const [gstAmount, setGstAmount] = useState(1000)
  const [gstRate, setGstRate] = useState(18)
  const [pctAmount, setPctAmount] = useState(1000)
  const [pctRate, setPctRate] = useState(10)
  const [dateA, setDateA] = useState('')
  const [dateB, setDateB] = useState('')

  const [convType, setConvType] = useState<ConverterType>('length')
  const [convValue, setConvValue] = useState(1)
  const units = getUnits(convType)
  const [from, setFrom] = useState('meter')
  const [to, setTo] = useState('kilometer')
  const safeFrom = units.includes(from) ? from : units[0]
  const safeTo = units.includes(to) ? to : units[1] ?? units[0]

  const emi = calculateEmi(principal, rate, tenure)
  const total = emi * tenure
  const effectivePaidMonths = startDate ? monthsBetween(startDate) : paidMonths
  const scenarios = useMemo(
    () => estimateScenarios(origLoan, currentBal, effectivePaidMonths),
    [origLoan, currentBal, effectivePaidMonths],
  )

  const dateDiff = useMemo(() => {
    if (!dateA || !dateB) return null
    const a = new Date(dateA), b = new Date(dateB)
    return Math.round(Math.abs(b.getTime() - a.getTime()) / 86400000)
  }, [dateA, dateB])

  const tabs: Array<[Tab,string]> = [
    ['basic','Calculator'],['loan','Loan / EMI'],['gst','GST'],
    ['percentage','Percentage'],['date','Date'],['converter','Converter'],
  ]

  return (
    <main className="scc-page">
      <section className="scc-hero">
        <div>
          <span className="scc-eyebrow">1 Hub Apps · App #006</span>
          <h1>Smart Calculator & Converter</h1>
          <p>Everyday calculations, EMI analysis and unit conversions in one fast browser tool.</p>
        </div>
        <div className="scc-pill">⚡ Local & fast</div>
      </section>

      <div className="scc-tabs">
        {tabs.map(([key,label]) => (
          <button key={key} type="button" className={tab===key?'is-active':''} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
        <section className="scc-card">
          <label>Expression<input value={expression} onChange={(e)=>setExpression(e.target.value)} /></label>
          <div className="scc-big-result">{safeCalc(expression) ?? 'Invalid expression'}</div>
        </section>
      )}

      {tab === 'loan' && (
        <section className="scc-card">
          <div className="scc-subtabs">
            <button type="button" className={loanMode==='standard'?'is-active':''} onClick={()=>setLoanMode('standard')}>Standard EMI</button>
            <button type="button" className={loanMode==='existing'?'is-active':''} onClick={()=>setLoanMode('existing')}>Existing Loan Estimator</button>
          </div>

          {loanMode === 'standard' ? (
            <>
              <div className="scc-grid-3">
                <label>Loan amount<input type="number" value={principal} onChange={(e)=>setPrincipal(Number(e.target.value))}/></label>
                <label>ROI % p.a.<input type="number" value={rate} step="0.1" onChange={(e)=>setRate(Number(e.target.value))}/></label>
                <label>Tenure months<input type="number" value={tenure} onChange={(e)=>setTenure(Number(e.target.value))}/></label>
              </div>
              <div className="scc-results">
                <div><span>EMI</span><strong>{money(emi)}</strong></div>
                <div><span>Total interest</span><strong>{money(total-principal)}</strong></div>
                <div><span>Total repayment</span><strong>{money(total)}</strong></div>
              </div>
            </>
          ) : (
            <>
              <div className="scc-note">
                When exact EMI/ROI/tenure is unavailable, this tool shows plausible scenarios based on original loan amount, current balance and repayment age. Results are estimates, not exact lender data.
              </div>
              <div className="scc-grid-2">
                <label>Original loan amount<input type="number" value={origLoan} onChange={(e)=>setOrigLoan(Number(e.target.value))}/></label>
                <label>Current outstanding<input type="number" value={currentBal} onChange={(e)=>setCurrentBal(Number(e.target.value))}/></label>
                <label>Loan start date (optional)<input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)}/></label>
                <label>Months already paid<input type="number" disabled={!!startDate} value={paidMonths} onChange={(e)=>setPaidMonths(Number(e.target.value))}/></label>
              </div>
              <div className="scc-note">Repayment track used: {effectivePaidMonths} completed months.</div>
              {scenarios.map((s,index)=>(
                <article className="scc-scenario" key={`${s.rate}-${s.tenure}`}>
                  <h3>Possible Scenario {String.fromCharCode(65+index)}</h3>
                  <div className="scc-results">
                    <div><span>Possible ROI</span><strong>{s.rate}%</strong></div>
                    <div><span>Possible original tenure</span><strong>{s.tenure} months</strong></div>
                    <div><span>Estimated EMI</span><strong>{money(s.emi)}</strong></div>
                    <div><span>Estimated current balance</span><strong>{money(s.balance)}</strong></div>
                    <div><span>Remaining tenure</span><strong>{s.remaining} months</strong></div>
                    <div><span>Principal repaid</span><strong>{money(s.principalRepaid)}</strong></div>
                  </div>
                </article>
              ))}
            </>
          )}
        </section>
      )}

      {tab === 'gst' && (
        <section className="scc-card">
          <div className="scc-grid-2">
            <label>Base amount<input type="number" value={gstAmount} onChange={(e)=>setGstAmount(Number(e.target.value))}/></label>
            <label>GST rate %<input type="number" value={gstRate} onChange={(e)=>setGstRate(Number(e.target.value))}/></label>
          </div>
          <div className="scc-results">
            <div><span>GST amount</span><strong>₹{(gstAmount*gstRate/100).toFixed(2)}</strong></div>
            <div><span>Total incl. GST</span><strong>₹{(gstAmount+gstAmount*gstRate/100).toFixed(2)}</strong></div>
          </div>
        </section>
      )}

      {tab === 'percentage' && (
        <section className="scc-card">
          <div className="scc-grid-2">
            <label>Amount<input type="number" value={pctAmount} onChange={(e)=>setPctAmount(Number(e.target.value))}/></label>
            <label>Percentage / discount %<input type="number" value={pctRate} onChange={(e)=>setPctRate(Number(e.target.value))}/></label>
          </div>
          <div className="scc-results">
            <div><span>Percentage value</span><strong>₹{(pctAmount*pctRate/100).toFixed(2)}</strong></div>
            <div><span>After discount</span><strong>₹{(pctAmount-pctAmount*pctRate/100).toFixed(2)}</strong></div>
          </div>
        </section>
      )}

      {tab === 'date' && (
        <section className="scc-card">
          <div className="scc-grid-2">
            <label>Date 1<input type="date" value={dateA} onChange={(e)=>setDateA(e.target.value)}/></label>
            <label>Date 2<input type="date" value={dateB} onChange={(e)=>setDateB(e.target.value)}/></label>
          </div>
          <div className="scc-big-result">{dateDiff == null ? 'Select two dates' : `${dateDiff} days`}</div>
        </section>
      )}

      {tab === 'converter' && (
        <section className="scc-card">
          <div className="scc-grid-3">
            <label>Type
              <select value={convType} onChange={(e)=>{
                const next = e.target.value as ConverterType
                setConvType(next)
                const nextUnits = getUnits(next)
                setFrom(nextUnits[0]); setTo(nextUnits[1] ?? nextUnits[0])
              }}>
                <option value="length">Length</option>
                <option value="weight">Weight</option>
                <option value="temperature">Temperature</option>
                <option value="speed">Speed</option>
                <option value="storage">Data storage</option>
              </select>
            </label>
            <label>From<select value={safeFrom} onChange={(e)=>setFrom(e.target.value)}>{units.map(u=><option key={u}>{u}</option>)}</select></label>
            <label>To<select value={safeTo} onChange={(e)=>setTo(e.target.value)}>{units.map(u=><option key={u}>{u}</option>)}</select></label>
          </div>
          <label>Value<input type="number" value={convValue} onChange={(e)=>setConvValue(Number(e.target.value))}/></label>
          <div className="scc-big-result">
            {convertValue(convType, convValue, safeFrom, safeTo).toLocaleString(undefined,{maximumFractionDigits:8})}
          </div>
        </section>
      )}
    </main>
  )
}
