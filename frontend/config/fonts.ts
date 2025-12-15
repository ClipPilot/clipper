import { Space_Mono, JetBrains_Mono, Luckiest_Guy, Montserrat } from "next/font/google";
import localFont from 'next/font/local'

export const fontSans = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

export const fontLuckiestGuy = Luckiest_Guy({
  subsets: ["latin"],
  variable: "--font-luckiest-guy",
  weight: ["400"],
});

export const fontMontserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  weight: ["700"],
});

export const fontEverlasting = localFont({
  src: '../public/fonts/Everlasting.ttf',
  variable: '--font-everlasting',
  weight: '700',
});

export const fontKomika = localFont({
  src: '../public/fonts/KOMIKAHB.ttf',
  variable: '--font-komika',
  weight: '400',
});

export const fontBurbank = localFont({
  src: '../public/fonts/Burbank Big Regular Bold.otf',
  variable: '--font-burbank',
  weight: '700',
});

export const fontMono = Space_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "700"],
});
