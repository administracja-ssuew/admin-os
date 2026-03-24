// plik: app/layout.tsx
import './globals.css'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import AuthGuard from '../components/AuthGuard' // <-- DODAJ TEN IMPORT

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'AdminOS - System Zarządzania',
  description: 'Wewnętrzny system operacyjny Komisji',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl" className="dark">
      <body className={inter.className}>
        {/* OWINĘLIŚMY CAŁY SYSTEM W BRAMKARZA */}
        <AuthGuard>
          {children}
        </AuthGuard>
        <Toaster position="bottom-right" />
      </body>
    </html>
  )
}