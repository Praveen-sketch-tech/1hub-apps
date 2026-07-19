import { createSeededRandom, pick } from './random'

export interface SampleRecord {
  id: number
  customer: string
  email: string | null
  city: string
  category: string
  status: string
  orderDate: string
  quantity: number
  unitPrice: number
  discount: number | null
  total: number
}

export interface DataFactoryOptions {
  rowCount?: number
  includeDuplicates?: boolean
  includeMissingValues?: boolean
  seed?: number
}

const firstNames = ['Aarav', 'Diya', 'Kabir', 'Meera', 'Rohan', 'Anaya', 'Vivaan', 'Ishita', 'Arjun', 'Sara']
const lastNames = ['Sharma', 'Patel', 'Verma', 'Singh', 'Gupta', 'Khan', 'Mehta', 'Jain']
const cities = ['Indore', 'Bhopal', 'Mandsaur', 'Mumbai', 'Delhi', 'Pune', 'Jaipur', 'Bengaluru']
const categories = ['Software', 'Hardware', 'Services', 'Office', 'Marketing']
const statuses = ['Paid', 'Pending', 'Refunded', 'Processing']

export function generateSampleRecords(options: DataFactoryOptions = {}): SampleRecord[] {
  const rowCount = Math.max(5, Math.min(options.rowCount ?? 30, 5000))
  const random = createSeededRandom(options.seed ?? 17017)
  const rows: SampleRecord[] = []

  for (let index = 0; index < rowCount; index += 1) {
    const customer = `${pick(firstNames, random)} ${pick(lastNames, random)}`
    const quantity = 1 + Math.floor(random() * 10)
    const unitPrice = Math.round((99 + random() * 4900) * 100) / 100
    const discount = Math.round(random() * 25 * 100) / 100
    const dayOffset = Math.floor(random() * 365)
    const date = new Date(Date.UTC(2025, 0, 1 + dayOffset))
    const shouldMiss = options.includeMissingValues && index > 0 && index % 7 === 0

    rows.push({
      id: 1001 + index,
      customer,
      email: shouldMiss ? null : `${customer.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      city: pick(cities, random),
      category: pick(categories, random),
      status: pick(statuses, random),
      orderDate: date.toISOString().slice(0, 10),
      quantity,
      unitPrice,
      discount: shouldMiss ? null : discount,
      total: Math.round(quantity * unitPrice * (1 - discount / 100) * 100) / 100,
    })
  }

  if (options.includeDuplicates && rows.length >= 8) {
    rows.splice(6, 0, { ...rows[2], id: rows[2].id })
    rows.push({ ...rows[4], id: rows[4].id })
  }

  return rows
}
