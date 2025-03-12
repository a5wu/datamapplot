import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Bluesky Atlas - Interactive Social Graph Visualization",
  description: "Explore the Bluesky social graph through an interactive visualization that maps user relationships and communities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full w-full m-0 p-0 overflow-hidden">
      <body className={`${inter.className} h-full w-full m-0 p-0 overflow-hidden`}>
        {children}
      </body>
    </html>
  );
}
