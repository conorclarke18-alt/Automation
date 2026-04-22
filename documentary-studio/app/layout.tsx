import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentary Studio',
  description:
    'Fern-style documentary video studio — script → ElevenLabs VO → archival B-roll → Remotion render.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
