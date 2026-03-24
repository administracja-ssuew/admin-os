import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import AuthGuard from '../components/AuthGuard'
import GlobalSearch from '../components/GlobalSearch' // <-- DODANY IMPORT

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AdminOS - System Operacyjny',
  description: 'Wewnętrzny system zarządzania operacyjnego Komisji',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body className={`${inter.className} bg-slate-50 dark:bg-slate-900 transition-colors duration-300`}>
        <Toaster position="top-right" />
        <GlobalSearch /> {/* <-- DODANY KOMPONENT NASŁUCHUJĄCY */}
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  )
}