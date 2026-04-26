import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-[20px] font-bold">404 — Not Found</h1>
        <p className="text-[13px] text-text-muted">The page you requested does not exist.</p>
        <Link
          href="/"
          className="inline-block bg-accent text-background px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] min-h-[44px]"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
