import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plan de l'usine — Points de prélèvement",
  description: "Carte interactive des zones et points de prélèvement",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
