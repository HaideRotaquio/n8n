import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-700.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import { themeToCssVars } from "@sb/core";
import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { SoundProvider } from "@/components/sound";
import { designFor } from "@/designs";
import { getCommerce, getShopper, getStore } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStore();
  if (!store) return { title: "Storefront not found", robots: { index: false } };
  const c = store.brand.config;
  return { title: { default: `${c.name} — ${c.tagline}`, template: `%s · ${c.name}` }, description: c.description || c.tagline };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const store = await getStore();
  if (!store) {
    return (
      <html lang="en">
        <body className="min-h-screen antialiased">{children}</body>
      </html>
    );
  }
  const shopper = await getShopper();
  const active = getCommerce().active;
  const c = store.brand.config;
  const vars = themeToCssVars(c.theme);
  // Fully rounded brands: keep shared UI (forms, cards) readable; the brand design sets its own shapes.
  if (vars["--radius"] === "9999px") vars["--radius"] = "20px";
  const { Shell } = designFor(store.brand);
  const dark = c.layout === "studio-dark";
  return (
    <html lang="en" style={{ colorScheme: dark ? "dark" : "light" }}>
      <body className="flex min-h-screen flex-col antialiased" style={vars as CSSProperties} data-layout={c.layout}>
        <SoundProvider>
          <Shell brandName={c.name} tagline={c.tagline} signedIn={!!shopper} testMode={!!active?.testMode}>
            {children}
          </Shell>
        </SoundProvider>
      </body>
    </html>
  );
}
