import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Esvita Clinic — Candidate Assessment",
  description: "Roleplay-based assessment for the Senior Medical Advisor position",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
