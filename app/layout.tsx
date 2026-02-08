import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { EnsembleOnboarding } from '@/components/setup/EnsembleOnboarding'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Google Ensemble',
    description: 'Autonomous Agentic IDE powered by Google Gemini',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} bg-background text-foreground antialiased min-h-screen selection:bg-primary/20`}>
                <EnsembleOnboarding />
                {children}
            </body>
        </html>
    )
}
