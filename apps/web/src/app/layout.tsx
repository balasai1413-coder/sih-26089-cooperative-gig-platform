import type { Metadata } from 'next';
import './styles.css';
import { AuthProvider } from '@/lib/auth/auth-context';

export const metadata: Metadata = {
  title: {
    default: 'Sahakar — Work, with more power behind it',
    template: '%s · Sahakar',
  },
  description: 'A trusted cooperative platform for skills, services, and opportunity.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
