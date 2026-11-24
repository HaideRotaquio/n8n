import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        Back to overview
      </Link>
    </main>
  );
}
