'use client'

interface UrlInputProps {
  onSubmit: (url: string) => void
  loading: boolean
}

export function UrlInput({ onSubmit, loading }: UrlInputProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const url = (form.elements.namedItem('url') as HTMLInputElement).value.trim()
    if (url) onSubmit(url)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 mb-6">
      <input
        name="url"
        type="url"
        placeholder="https://jp.mercari.com/item/m12345678"
        required
        className="
          flex-1 bg-zinc-900 border border-zinc-700 rounded-lg
          px-4 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-600
          focus:outline-none focus:border-blue-500
        "
      />
      <button
        type="submit"
        disabled={loading}
        className="
          bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700
          text-white font-semibold text-sm rounded-lg px-5 py-2.5
          transition-colors whitespace-nowrap
        "
      >
        {loading ? 'Searching…' : 'Compare →'}
      </button>
    </form>
  )
}
