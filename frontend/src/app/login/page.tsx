"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { AuthCard } from "@/components/AuthCard";
import { Alert, Button, Field, Input, Spinner } from "@/components/ui";

export default function LoginPage() {
  const { login, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const next = () => {
    const target = new URLSearchParams(window.location.search).get("next");
    // Only allow in-app paths.
    return target && target.startsWith("/") && !target.startsWith("//") ? target : "/dashboard";
  };

  useEffect(() => {
    if (status === "authenticated") router.replace(next());
  }, [status, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(email, password);
      router.replace(user.mustChangePassword ? "/account?setup=1" : next());
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <AuthCard title="Sign in" subtitle="Accounts are created by your administrator.">
      <form onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email">
          {(id) => (
            <Input
              id={id}
              type="email"
              autoComplete="username"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <Field label="Password">
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" loading={submitting} className="mt-1 w-full">
          Sign in
        </Button>
        <Link href="/forgot-password" className="text-center text-sm text-accent hover:underline">
          Forgot your password?
        </Link>
      </form>
    </AuthCard>
  );
}
