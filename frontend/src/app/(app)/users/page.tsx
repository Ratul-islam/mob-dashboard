"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, MoreHorizontal, Pencil, Power, Trash2, UserPlus } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatRelative, formatUtc } from "@/lib/format";
import type { User } from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Alert, Badge, Button, Card, Dialog, Field, IconButton, Input, Popover, Spinner, Switch, toast } from "@/components/ui";

type Credentials = { name: string; email: string; password: string; title: string };

export default function UsersPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api<User[]>("/user") });
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Pick<User, "name" | "email" | "isActive">> }) =>
      api<User>(`/user/${id}`, { method: "PATCH", body }),
    onSuccess: invalidate,
  });
  const resetPassword = useMutation({
    mutationFn: (id: string) => api<{ password: string }>(`/user/${id}/reset-password`, { method: "POST", body: {} }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/user/${id}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Create accounts and hand the sign-in details to each person. They must choose their own password on first sign-in."
        actions={
          <Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setCreating(true)}>
            New user
          </Button>
        }
      />

      <Card>
        {users.error ? (
          <div className="p-4">
            <Alert tone="error">{errorMessage(users.error)}</Alert>
          </div>
        ) : !users.data ? (
          <div className="flex justify-center py-12">
            <Spinner className="size-6" />
          </div>
        ) : (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-left text-xs text-ink-2">
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Last sign-in</th>
                  <th className="px-3 py-2 font-medium">Created (UTC)</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">
                        {u.name} {u.id === me?.id && <span className="text-xs font-normal text-muted">(you)</span>}
                      </div>
                      <div className="text-xs text-muted">{u.email}</div>
                    </td>
                    <td className="px-3 py-2.5">{u.role === "root" ? <Badge tone="accent">root</Badge> : <Badge>user</Badge>}</td>
                    <td className="px-3 py-2.5">
                      {!u.isActive ? (
                        <Badge tone="critical">Disabled</Badge>
                      ) : u.mustChangePassword ? (
                        <Badge tone="warning">Awaiting first sign-in</Badge>
                      ) : (
                        <Badge tone="good">Active</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-ink-2">{u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Never"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">{formatUtc(u.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {u.role !== "root" && (
                        <Popover
                          trigger={({ toggle, open }) => (
                            <IconButton label={`Actions for ${u.name}`} onClick={toggle} active={open}>
                              <MoreHorizontal className="size-4" />
                            </IconButton>
                          )}
                        >
                          {(close) => (
                            <div className="flex flex-col">
                              <Item icon={<Pencil className="size-4" />} onClick={() => (close(), setEditing(u))}>
                                Edit details
                              </Item>
                              <Item
                                icon={<KeyRound className="size-4" />}
                                onClick={() => {
                                  close();
                                  if (!confirm(`Generate a new password for ${u.name}? Their current sessions will end.`)) return;
                                  run(async () => {
                                    const { password } = await resetPassword.mutateAsync(u.id);
                                    setCredentials({ name: u.name, email: u.email, password, title: "New password" });
                                    invalidate();
                                  });
                                }}
                              >
                                Reset password
                              </Item>
                              <Item
                                icon={<Power className="size-4" />}
                                onClick={() => {
                                  close();
                                  run(
                                    () => update.mutateAsync({ id: u.id, body: { isActive: !u.isActive } }),
                                    u.isActive ? `${u.name} can no longer sign in` : `${u.name} can sign in again`,
                                  );
                                }}
                              >
                                {u.isActive ? "Disable account" : "Enable account"}
                              </Item>
                              <Item
                                danger
                                icon={<Trash2 className="size-4" />}
                                onClick={() => {
                                  close();
                                  if (confirm(`Delete ${u.name} (${u.email})? This can't be undone.`)) {
                                    run(() => remove.mutateAsync(u.id), "User deleted");
                                  }
                                }}
                              >
                                Delete user
                              </Item>
                            </div>
                          )}
                        </Popover>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <CreateUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          setCreating(false);
          setCredentials(c);
          invalidate();
        }}
      />
      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSave={async (body) => {
          if (!editing) return;
          await update.mutateAsync({ id: editing.id, body });
          toast.success("User updated");
          setEditing(null);
        }}
      />
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </>
  );
}

function Item({ icon, children, onClick, danger }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${danger ? "text-critical" : "text-ink"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function CreateUserDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: Credentials) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [choosePassword, setChoosePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ user: User; initialPassword: string }>("/user", {
        method: "POST",
        body: { name, email, ...(choosePassword ? { password } : {}) },
      });
      onCreated({ name: res.user.name, email: res.user.email, password: res.initialPassword, title: "Account created" });
      setName("");
      setEmail("");
      setPassword("");
      setChoosePassword(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New user"
      description="They'll be asked to set their own password when they first sign in."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="create-user" loading={busy}>
            Create user
          </Button>
        </>
      }
    >
      <form id="create-user" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name">{(id) => <Input id={id} required maxLength={100} autoFocus value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Email">{(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Switch
          checked={choosePassword}
          onChange={setChoosePassword}
          label="Set the temporary password myself"
          description="Otherwise a strong one is generated for you."
        />
        {choosePassword && (
          <Field label="Temporary password" hint="At least 8 characters.">
            {(id) => (
              <Input id={id} type="text" required minLength={8} maxLength={128} autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
        )}
      </form>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  onClose,
  onSave,
}: {
  user: User | null;
  onClose: () => void;
  onSave: (body: { name: string; email: string }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  if (user && loadedFor !== user.id) {
    setLoadedFor(user.id);
    setName(user.name);
    setEmail(user.email);
    setError(null);
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSave({ name, email });
      setLoadedFor(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!user}
      onClose={() => {
        setLoadedFor(null);
        onClose();
      }}
      title="Edit user"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="edit-user" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="edit-user" onSubmit={submit} className="flex flex-col gap-4">
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Name">{(id) => <Input id={id} required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label="Email" hint="Changing the email signs the user out everywhere.">
          {(id) => <Input id={id} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
      </form>
    </Dialog>
  );
}

function CredentialsDialog({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = credentials
    ? `Sign in at ${typeof window !== "undefined" ? window.location.origin : ""}/login\nEmail: ${credentials.email}\nTemporary password: ${credentials.password}\nYou'll be asked to choose your own password after signing in.`
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy. Select the text and copy it manually.");
    }
  };

  return (
    <Dialog
      open={!!credentials}
      onClose={onClose}
      title={credentials?.title ?? ""}
      description="Share these details with the person. The password won't be shown again."
      footer={
        <>
          <Button icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />} onClick={copy}>
            {copied ? "Copied" : "Copy details"}
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      {credentials && (
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd>{credentials.name}</dd>
          <dt className="text-muted">Email</dt>
          <dd className="font-mono text-[13px]">{credentials.email}</dd>
          <dt className="text-muted">Password</dt>
          <dd className="font-mono text-[13px] select-all">{credentials.password}</dd>
        </dl>
      )}
    </Dialog>
  );
}
