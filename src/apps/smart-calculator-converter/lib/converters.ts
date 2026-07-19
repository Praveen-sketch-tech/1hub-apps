export type ConverterType = 'length' | 'weight' | 'temperature' | 'speed' | 'storage'

const factors = {
  length: { meter:1, kilometer:1000, centimeter:0.01, millimeter:0.001, inch:0.0254, foot:0.3048, yard:0.9144, mile:1609.344 },
  weight: { kilogram:1, gram:0.001, milligram:0.000001, pound:0.45359237, ounce:0.028349523125 },
  speed: { 'km/h':1, 'm/s':3.6, mph:1.609344 },
  storage: { byte:1, KB:1024, MB:1024**2, GB:1024**3, TB:1024**4 },
} as const

export function getUnits(type: ConverterType): string[] {
  if (type === 'temperature') return ['Celsius','Fahrenheit','Kelvin']
  return Object.keys(factors[type])
}

export function convertValue(type: ConverterType, value: number, from: string, to: string): number {
  if (type === 'temperature') {
    let c = value
    if (from === 'Fahrenheit') c = (value - 32) * 5 / 9
    else if (from === 'Kelvin') c = value - 273.15
    if (to === 'Fahrenheit') return c * 9 / 5 + 32
    if (to === 'Kelvin') return c + 273.15
    return c
  }
  const map = factors[type] as Record<string, number>
  return value * map[from] / map[to]
}
