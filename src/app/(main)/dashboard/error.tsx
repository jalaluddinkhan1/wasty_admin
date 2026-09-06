"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const forbidden = /permission|unauthorized|cannot use|cannot access/i.test(error.message);

  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
      <h1 className="font-semibold text-2xl">{forbidden ? "You cannot open this page" : "Something went wrong"}</h1>
      <p className="max-w-md text-muted-foreground text-sm">
        {forbidden ? "This admin type does not include that area." : error.message}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button asChild>
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
