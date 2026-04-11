export const FALLBACK_RATE = 0.0067  // approximate JPY → USD, used if API is down

export async function fetchExchangeRate(): Promise<number> {
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=JPY&to=USD')
    if (!res.ok) return FALLBACK_RATE
    const data = await res.json() as { rates: { USD: number } }
    return data.rates.USD
  } catch {
    return FALLBACK_RATE
  }
}
