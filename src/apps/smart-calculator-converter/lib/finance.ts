export function calculateEmi(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  if (annualRate <= 0) return principal / months
  const r = annualRate / 12 / 100
  const f = Math.pow(1 + r, months)
  return principal * r * f / (f - 1)
}

export function outstandingAfterMonths(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  paidMonths: number,
): number {
  if (paidMonths <= 0) return principal
  if (paidMonths >= tenureMonths) return 0
  if (annualRate <= 0) return Math.max(0, principal * (1 - paidMonths / tenureMonths))
  const r = annualRate / 12 / 100
  const emi = calculateEmi(principal, annualRate, tenureMonths)
  const f = Math.pow(1 + r, paidMonths)
  return Math.max(0, principal * f - emi * ((f - 1) / r))
}

export function monthsBetween(startDate: string): number {
  const start = new Date(startDate)
  const end = new Date()
  if (Number.isNaN(start.getTime())) return 0
  let months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

export function estimateScenarios(
  principal: number,
  outstanding: number,
  paidMonths: number,
) {
  const rates = [8,10,12,14,16,18,20,22,24]
  const tenures = [12,18,24,30,36,48,60,72,84,120,180,240]
  const rows = []

  for (const rate of rates) {
    for (const tenure of tenures) {
      if (tenure <= paidMonths) continue
      const balance = outstandingAfterMonths(principal, rate, tenure, paidMonths)
      rows.push({
        rate,
        tenure,
        emi: calculateEmi(principal, rate, tenure),
        balance,
        remaining: tenure - paidMonths,
        principalRepaid: Math.max(0, principal - balance),
        error: Math.abs(balance - outstanding),
      })
    }
  }

  return rows.sort((a,b) => a.error - b.error).slice(0, 3)
}
