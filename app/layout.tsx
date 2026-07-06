import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter, Geist_Mono } from 'next/font/google'
import { WorkspaceProvider } from '@/lib/workspace-context'
import { AuthProvider } from '@/lib/auth-context'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
})

export const metadata: Metadata = {
  title: 'Postly — AI-Powered Social Media Management',
  description: 'Schedule, publish, and analyze your social media content with AI-powered insights.',
  generator: 'v0.app',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-background">
      <body className={`${inter.variable} ${geistMono.variable} font-sans antialiased`}>
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          async
          defer
        />
        <AuthProvider>
          <WorkspaceProvider>
            {children}
          </WorkspaceProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
