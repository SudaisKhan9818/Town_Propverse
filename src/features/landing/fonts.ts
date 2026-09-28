// fonts.ts — self-hosted display/mono/sans faces for the landing hero.
// Exposed as the same CSS variables globals.css already references.

import { IBM_Plex_Mono, Inter, Playfair_Display } from 'next/font/google';

const serif = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  weight: ['400', '500'],
  variable: '--font-serif-custom',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-custom',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans-custom',
  display: 'swap',
});

export const fontVariables = `${serif.variable} ${mono.variable} ${sans.variable}`;
