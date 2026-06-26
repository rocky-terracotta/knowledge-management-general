"use client";

import { FormEvent, useMemo, useState } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => searchParams.get("next") || "/", [searchParams]);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to sign in.");
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="digest-shell flex min-h-screen items-center justify-center px-6 py-10">
      <section className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">Terracotta</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">Knowledge Management</h1>
        </div>

        <div className="rounded-md border border-[color:var(--border)] bg-white/55 p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <span className="inline-flex size-10 items-center justify-center rounded-md bg-[color:var(--accent)] text-[color:var(--primary)]">
              <LockKeyhole className="size-5" />
            </span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">Workspace Access</h2>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Enter the workspace password.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-[color:var(--foreground)]">Password</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                autoFocus
                className="h-11 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-base text-[color:var(--foreground)] outline-none transition-colors focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--accent)]"
              />
            </label>

            {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}

            <button
              type="submit"
              disabled={isSubmitting || !password}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--primary)] px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#681127] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
              Continue
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
