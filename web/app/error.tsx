"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-background text-foreground font-mono flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-[20px] font-bold">Something went wrong</h1>
        <p className="text-[13px] text-text-muted">{error.message || "An unexpected error occurred."}</p>
        <button
          onClick={reset}
          className="bg-accent text-background px-4 py-2 text-[13px] font-bold hover:bg-[#00cc33] min-h-[44px]"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
