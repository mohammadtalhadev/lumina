import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import LenisProvider from '@/components/LenisProvider';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import './globals.css';

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Lumina — Client Acquisition Command Center',
  description: 'Internal dashboard for the Lumina outreach system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <LenisProvider>
          <div className="aurora-canvas min-h-screen">
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm"
            >
              Skip to main content
            </a>
            <Sidebar />
            <div className="pl-72">
              <Topbar />
              <main id="main" className="px-6 pb-10">
                {children}
              </main>
            </div>
          </div>
        </LenisProvider>
      </body>
    </html>
  );
}
