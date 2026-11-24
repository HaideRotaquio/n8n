import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-semibold">You don't have access to this page</h1>
      <p className="mt-2 text-sm text-[var(--color-muted-text)]">
        Ask an owner or administrator to grant you the role you need.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        Back to overview
      </Link>
    </main>
  );
}
