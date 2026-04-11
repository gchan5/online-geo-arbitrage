interface TranslateResult {
  text: string
  failed: boolean
}

export async function translateToEnglish(text: string): Promise<TranslateResult> {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY
  if (!apiKey) {
    return { text, failed: true }
  }

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'ja', target: 'en', format: 'text' }),
    })

    if (!res.ok) return { text, failed: true }

    const data = await res.json() as {
      data: { translations: Array<{ translatedText: string }> }
    }
    const translated = data.data.translations[0]?.translatedText
    if (!translated) return { text, failed: true }

    return { text: translated, failed: false }
  } catch {
    return { text, failed: true }
  }
}
