import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist_Mono, Noto_Sans_KR } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { Providers } from '@/components/explorer/providers'
import { getRequestLocale } from '@/lib/i18n/server'
import { createTranslator } from '@/lib/i18n/translate'
import './globals.css'

const _notoSansKR = Noto_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
})
const _geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale()
  const t = createTranslator(locale)
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    generator: 'v0.app',
    icons: {
      icon: [
        {
          url: '/icon-light-32x32.png',
          media: '(prefers-color-scheme: light)',
        },
        {
          url: '/icon-dark-32x32.png',
          media: '(prefers-color-scheme: dark)',
        },
        {
          url: '/icon.svg',
          type: 'image/svg+xml',
        },
      ],
      apple: '/apple-icon.png',
    },
  }
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#15161c',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getRequestLocale()

  return (
    <html lang={locale} className={`dark bg-background ${_notoSansKR.variable} ${_geistMono.variable}`}>
      <body className="font-sans antialiased">
        <Providers locale={locale}>{children}</Providers>
        <Toaster />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
