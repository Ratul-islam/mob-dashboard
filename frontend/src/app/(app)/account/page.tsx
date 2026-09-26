"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Button, Card, CardHeader, Field, Input, toast } from "@/components/ui";

export default function AccountPage() {
  const { user, applySession } = useAuth();
  const router = useRouter();
  const mustChange = Boolean(user?.mustChangePassword);

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [profilePassword, setProfilePassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  // Re-sync the form when the signed-in user changes (e.g. after saving).
  const [syncedUser, setSyncedUser] = useState(user);
  if (user && user !== syncedUser) {
    setSyncedUser(user);
    setName(user.name);
    setEmail(user.email);
  }

  if (!user) return null;
  const emailChanged = email.trim().toLowerCase() !== user.email;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      const data = await api<{ user: User; accessToken?: string }>("/account", {
        method: "PATCH",
        body: { name, email, ...(emailChanged ? { currentPassword: profilePassword } : {}) },
      });
      applySession(data);
      setProfilePassword("");
      toast.success(emailChanged ? "Profile saved. Other sessions were signed out." : "Profile saved");
    } catch (err) {
      setProfileError(errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (next !== confirm) return setPasswordError("New passwords don't match");
    setSavingPassword(true);
    try {
      const data = await api<{ user: User; accessToken: string }>("/account/password", {
        method: "POST",
        body: { currentPassword: current, newPassword: next },
      });
      applySession(data);
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed. Other sessions were signed out.");
      if (mustChange) router.replace("/dashboard");
    } catch (err) {
      setPasswordError(errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <PageHeader title="My account" description="Update your name, sign-in email and password." />

      <div className="flex max-w-2xl flex-col gap-4">
        {mustChange && (
          <Alert tone="warning" title="Choose your own password">
            Your account was set up with a temporary password. Set a new one to continue to the dashboard.
          </Alert>
        )}

        <Card>
          <CardHeader title="Password" subtitle="At least 8 characters. Changing it signs you out on other devices." />
          <form onSubmit={changePassword} className="flex flex-col gap-4 px-4 pb-4">
            {passwordError && <Alert tone="error">{passwordError}</Alert>}
            <Field label={mustChange ? "Temporary password" : "Current password"}>
              {(id) => (
                <Input id={id} type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="New password">
                {(id) => (
                  <Input id={id} type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
                )}
              </Field>
              <Field label="Confirm new password">
                {(id) => (
                  <Input id={id} type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                )}
              </Field>
            </div>
            <div>
              <Button type="submit" variant="primary" loading={savingPassword}>
                Change password
              </Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader title="Profile" />
          <form onSubmit={saveProfile} className="flex flex-col gap-4 px-4 pb-4">
            {profileError && <Alert tone="error">{profileError}</Alert>}
            <Field label="Name">{(id) => <Input id={id} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
            <Field label="Email (used to sign in)">
              {(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
            </Field>
            {emailChanged && (
              <Field label="Current password" hint="Required to change your sign-in email.">
                {(id) => (
                  <Input id={id} type="password" required autoComplete="current-password" value={profilePassword} onChange={(e) => setProfilePassword(e.target.value)} />
                )}
              </Field>
            )}
            <div>
              <Button type="submit" loading={savingProfile} disabled={mustChange || (name === user.name && !emailChanged)}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
