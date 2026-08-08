import Link from "next/link";

import { Nav } from "@/components/Nav";

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-5 py-28 sm:px-8">
        <p className="eyebrow text-grape-400">404</p>
        <h1 className="display mt-5 text-6xl leading-none">
          Nothing here.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-mist-500">
          That page does not exist. Creator pages live at{" "}
          <span className="font-mono text-mist-300">/c/&lt;handle&gt;</span> and
          goals at{" "}
          <span className="font-mono text-mist-300">
            /goal/&lt;handle&gt;/&lt;number&gt;
          </span>
          .
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/"
            className="btn-primary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
          >
            Browse goals
          </Link>
          <Link
            href="/dashboard"
            className="btn-secondary px-5 py-3 text-xs font-bold uppercase tracking-[0.08em]"
          >
            Creator studio
          </Link>
        </div>
      </main>
    </>
  );
}
