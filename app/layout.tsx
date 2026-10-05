import { Analytics } from '@vercel/analytics/next'
import AskTownAgentGlobal from '@/components/AskTownAgentGlobal'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PropVerse — See the town before it exists.',
  description: 'A 3D real estate intelligence platform for exploring towns, plots, and possibilities before they take shape.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f3eee6',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="bg-background"><body className="antialiased">{children}<AskTownAgentGlobal />{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
