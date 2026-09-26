import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { and, asc, desc, eq, getTableColumns, ne } from "drizzle-orm";
import { db } from "../../config/db.js";
import { users, UserRecord, UserRole, UserRow } from "./user.model.js";
import { AppError } from "../../utils/AppError.js";

const SALT_ROUNDS = 12;

type Query = {
  id?: string | number;
  email?: string;
};

export const hashPassword = (password: string) => bcrypt.hash(password, SALT_ROUNDS);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

/** Generates a readable temporary password, e.g. for accounts created by root. */
export const generatePassword = (length = 14) => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  return Array.from(crypto.randomBytes(length), (b) => alphabet[b % alphabet.length]).join("");
};

const normalizeEmail = (email: string) => email.toLowerCase().trim();

const { password: _password, ...publicColumns } = getTableColumns(users);

export function getUser(query: Query, withPassword: true): Promise<UserRow | null>;
export function getUser(query: Query, withPassword?: false): Promise<UserRecord | null>;
export async function getUser(query: Query, withPassword = false): Promise<UserRecord | null> {
  let where;
  if (query.id !== undefined) {
    const id = Number(query.id);
    if (!Number.isInteger(id) || id <= 0) return null;
    where = eq(users.id, id);
  } else if (query.email) {
    where = eq(users.email, normalizeEmail(query.email));
  } else {
    throw new Error("Provide at least one search field");
  }

  const columns = withPassword ? getTableColumns(users) : publicColumns;
  const [user] = await db.select(columns).from(users).where(where).limit(1);
  return user ?? null;
}

export const listUsers = () =>
  db.select(publicColumns).from(users).orderBy(desc(eq(users.role, "root")), desc(users.createdAt), asc(users.id));

export const updateUser = async (id: number, patch: Partial<Omit<UserRow, "id" | "createdAt">>) => {
  await db.update(users).set(patch).where(eq(users.id, id));
};

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  mustChangePassword?: boolean;
  createdBy?: number;
};

export const createUser = async (input: CreateUserInput): Promise<UserRecord> => {
  const email = normalizeEmail(input.email);
  if (await getUser({ email })) throw new AppError("A user with this email already exists", 409);

  const [{ id }] = await db
    .insert(users)
    .values({
      name: input.name.trim(),
      email,
      password: await hashPassword(input.password),
      role: input.role ?? "user",
      mustChangePassword: input.mustChangePassword ?? false,
      createdBy: input.createdBy,
    })
    .$returningId();

  return (await getUser({ id }))!;
};

export const setPassword = async (user: UserRecord, password: string, mustChangePassword: boolean) => {
  const patch = {
    password: await hashPassword(password),
    mustChangePassword,
    credentialsChangedAt: new Date(),
  };
  await updateUser(user.id, patch);
  Object.assign(user, { mustChangePassword, credentialsChangedAt: patch.credentialsChangedAt });
};

export const updateUserProfile = async (user: UserRecord, input: { name?: string; email?: string }) => {
  const patch: Partial<UserRow> = {};
  if (input.email && normalizeEmail(input.email) !== user.email) {
    const email = normalizeEmail(input.email);
    const [taken] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, user.id)))
      .limit(1);
    if (taken) throw new AppError("A user with this email already exists", 409);
    patch.email = email;
    patch.credentialsChangedAt = new Date();
  }
  if (input.name) patch.name = input.name.trim();

  if (Object.keys(patch).length) {
    await updateUser(user.id, patch);
    Object.assign(user, patch);
  }
  return user;
};

export const deleteUser = (id: number) => db.delete(users).where(eq(users.id, id));

/**
 * Makes sure a root account exists. Creates it from ROOT_EMAIL / ROOT_PASSWORD on first boot;
 * afterwards the root user manages their own credentials from the app.
 */
export const ensureRootUser = async (root: { name: string; email: string; password: string }) => {
  const [existing] = await db.select(publicColumns).from(users).where(eq(users.role, "root")).limit(1);
  if (existing) return existing;

  if (!root.email || !root.password) {
    console.warn("No root user exists. Set ROOT_EMAIL and ROOT_PASSWORD in .env to create one.");
    return null;
  }

  // A short bootstrap password works once, then has to be replaced.
  const weak = root.password.length < 8;
  if (weak) console.warn("ROOT_PASSWORD is shorter than 8 characters; root must change it after first login.");

  const byEmail = await getUser({ email: root.email });
  if (byEmail) {
    await updateUser(byEmail.id, { role: "root", isActive: true });
    console.log(`Promoted ${byEmail.email} to root user`);
    return byEmail;
  }

  const user = await createUser({ ...root, role: "root", mustChangePassword: weak });
  console.log(`Created root user ${user.email}`);
  return user;
};
