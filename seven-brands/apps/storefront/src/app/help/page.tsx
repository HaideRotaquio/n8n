import type { Metadata } from "next";
import Link from "next/link";
import { designFor } from "@/designs";
import { requireStore } from "@/lib/store";

export const metadata: Metadata = { title: "Help" };

export default async function HelpPage() {
  const { brand } = await requireStore();
  const { Page } = designFor(brand);
  const name = brand.config.name;
  const faq: [string, React.ReactNode][] = [
    ["What do I get when I buy?", <>A ZIP for each icon with static and animated SVG, PNG, GIF, Lottie (JSON), MP4 and WebM video, the sound as WAV with a cue sheet, a React component, a Web Component and the source definition (JSON). Plus a LICENSE.txt with your name and license code.</>],
    ["Does the sound play automatically?", <>No. Sound is always off until someone turns it on, on our site and in the components you download. Browsers require a click or tap before any sound plays.</>],
    ["Can I change the colors?", <>Yes. Every icon uses named color tokens. Try it on any product page under “Try your own colors”; the React and Web Components accept the same tokens.</>],
    ["Which license do I need?", <>Personal for your own non-commercial projects, Commercial for your business, Team for up to 10 people, Agency for client work. <Link href="/help/licenses" className="underline">Compare licenses</Link>.</>],
    ["Where are my downloads?", <>In <Link href="/account" className="underline">your library</Link>, any time. Download links are created when you click and expire after a few minutes, so please don&apos;t share them.</>],
    ["Do I get updates?", <>Yes. If we improve an icon you bought, your library gives you the newest approved version at no cost.</>],
    ["Who handles payment and tax?", <>Our reseller (Merchant of Record) processes payment, collects sales tax/VAT where it applies and emails your receipt. We never see your card details.</>],
    ["How do I check a license?", <>Anyone can check a license code at <Link href="/licenses/verify" className="underline">Verify a license</Link>. It shows the product, license type and the licensee&apos;s initials.</>],
    ["How do I get my data?", <>From your library: “Download all your data”. To close your account, reply to any receipt email.</>],
  ];
  return (
    <Page title="Help" intro={`Answers to common questions about ${name}.`}>
      <div className="divide-y divide-[var(--color-border)] rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        {faq.map(([q, a]) => (
          <details key={q} className="group p-4">
            <summary className="cursor-pointer list-none font-semibold after:float-right after:content-['+'] group-open:after:content-['−']">{q}</summary>
            <div className="mt-2 text-[var(--color-muted-text)]">{a}</div>
          </details>
        ))}
      </div>
      <p className="text-sm">More: <Link href="/help/licenses" className="underline">Licenses explained</Link> · <Link href="/help/refunds" className="underline">Refund policy</Link></p>
    </Page>
  );
}
