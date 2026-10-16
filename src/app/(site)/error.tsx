"use client";
import { ErrorState } from "@/components/ui/kit";

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <ErrorState title="Something went wrong" description="An unexpected error occurred. You can try again." action={<button className="btn-primary mt-2" onClick={reset}>Try again</button>} />
    </div>
  );
}
