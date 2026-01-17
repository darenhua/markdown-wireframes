import type { Metadata } from "next";

import { Geist, Geist_Mono, Noto_Sans } from "next/font/google";

import "./globals.css";
import { Providers } from "../components/providers";
import { SidebarInset, SidebarProvider } from "../components/ui/sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSans = Noto_Sans({ variable: '--font-sans' });

export const metadata: Metadata = {
  title: "product",
  description: "product",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <SidebarProvider>
            <SidebarInset>
              <div className="grid h-full grid-rows-[auto_1fr]">
                {/* <Header /> */}
                {children}
              </div>
            </SidebarInset>
          </SidebarProvider>
        </Providers>
      </body>
    </html>
  );
}
