import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mercari Compare',
  description: 'Find eBay arbitrage opportunities from Mercari JP listings',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100">
        {children}
      </body>
    </html>
  )
}
