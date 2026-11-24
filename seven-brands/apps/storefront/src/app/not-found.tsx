import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-semibold">Not found</h1>
      <p className="mt-2 text-[var(--color-muted-text)]">This page doesn&apos;t exist, or this address isn&apos;t a Seven Brands storefront.</p>
      <Link href="/" className="mt-6 inline-block underline">
        Back to the catalog
      </Link>
    </div>
  );
}
