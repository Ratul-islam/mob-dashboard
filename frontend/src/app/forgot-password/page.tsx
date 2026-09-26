"use client";

import { useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/api";
import { AuthCard } from "@/components/AuthCard";
import { Alert, Button, Field, Input } from "@/components/ui";

type Step = "email" | "code" | "password" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const requestCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      await api("/auth/password-reset/request", { method: "POST", body: { email } });
      setStep("code");
    });
  };

  const verifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const data = await api<{ resetToken: string }>("/auth/password-reset/verify-otp", {
        method: "POST",
        body: { email, otp },
      });
      setResetToken(data.resetToken);
      setStep("password");
    });
  };

  const setNewPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords don't match");
    run(async () => {
      await api("/auth/password-reset/confirm", { method: "POST", body: { resetToken, newPassword: password } });
      setStep("done");
    });
  };

  return (
    <AuthCard
      title="Reset password"
      subtitle={
        step === "email"
          ? "We'll email you a 6-digit code."
          : step === "code"
            ? `If ${email} has an account, a code is on its way.`
            : step === "password"
              ? "Choose a new password."
              : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}

        {step === "email" && (
          <form onSubmit={requestCode} className="flex flex-col gap-4">
            <Field label="Email">
              {(id) => <Input id={id} type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            <Button type="submit" variant="primary" loading={busy}>
              Send code
            </Button>
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="flex flex-col gap-4">
            <Field label="Verification code" hint="The code expires after 10 minutes.">
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  required
                  autoFocus
                  autoComplete="one-time-code"
                  className="tracking-[0.4em]"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" loading={busy}>
              Verify
            </Button>
            <Button type="button" variant="ghost" onClick={() => setStep("email")}>
              Use a different email
            </Button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={setNewPassword} className="flex flex-col gap-4">
            <Field label="New password" hint="At least 8 characters.">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  minLength={8}
                  required
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Field>
            <Field label="Confirm password">
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  minLength={8}
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" variant="primary" loading={busy}>
              Update password
            </Button>
          </form>
        )}

        {step === "done" && <Alert tone="success">Your password was updated. You can sign in now.</Alert>}

        <Link href="/login" className="text-center text-sm text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    </AuthCard>
  );
}
