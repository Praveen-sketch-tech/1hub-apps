import type { AppChatModule } from '@core/chat/types'
import { calculateEmi } from './lib/finance'
import {
  convertValue,
  type ConverterType,
} from './lib/converters'

const aliases: Record<string, string> = {
  km: 'kilometer',
  kms: 'kilometer',
  m: 'meter',
  cm: 'centimeter',
  mm: 'millimeter',
  ft: 'foot',
  feet: 'foot',
  miles: 'mile',
  kg: 'kilogram',
  kgs: 'kilogram',
  g: 'gram',
  lbs: 'pound',
  c: 'Celsius',
  f: 'Fahrenheit',
  k: 'Kelvin',
}

export const chatModule: AppChatModule = {
  appId: 'smart-calculator-converter',
  actions: [
    {
      id: 'calculate-emi',
      appId: 'smart-calculator-converter',
      label: 'Calculate EMI',
      description: 'Calculate monthly EMI.',
      keywords: ['emi', 'loan emi'],
      canHandle: ({ input }) => /\bemi\b/i.test(input),
      execute: ({ input }) => {
        const numbers = [...input.matchAll(/[\d,.]+/g)]
          .map((match) => Number(match[0].replace(/,/g, '')))
          .filter(Number.isFinite)

        if (numbers.length < 3) {
          return {
            text: 'Amount, annual interest rate aur tenure months me batao. Example: EMI for 500000 at 10% for 60 months.',
          }
        }

        const [principal, annualRate, months] = numbers
        const emi = calculateEmi(principal, annualRate, months)

        return {
          text: `Estimated EMI: ₹${emi.toLocaleString('en-IN', {
            maximumFractionDigits: 2,
          })} per month.`,
        }
      },
    },
    {
      id: 'unit-convert',
      appId: 'smart-calculator-converter',
      label: 'Convert units',
      description: 'Convert common units.',
      keywords: ['convert', ' to ', ' into '],
      canHandle: ({ input }) =>
        /-?\d+(?:\.\d+)?\s*[a-zA-Z/]+\s+(?:to|in|into)\s+[a-zA-Z/]+/i.test(input),
      execute: ({ input }) => {
        const match = input.toLowerCase().match(
          /(-?\d+(?:\.\d+)?)\s*([a-zA-Z/]+)\s+(?:to|in|into)\s+([a-zA-Z/]+)/,
        )

        if (!match) return null

        const value = Number(match[1])
        const from = aliases[match[2]] ?? match[2]
        const to = aliases[match[3]] ?? match[3]

        const types: ConverterType[] = [
          'length',
          'weight',
          'temperature',
          'speed',
          'storage',
        ]

        for (const type of types) {
          try {
            const result = convertValue(type, value, from, to)

            if (Number.isFinite(result)) {
              return {
                text: `${value} ${from} = ${result.toLocaleString('en-IN', {
                  maximumFractionDigits: 6,
                })} ${to}`,
              }
            }
          } catch {
            // Try next type.
          }
        }

        return null
      },
    },
  ],
}
