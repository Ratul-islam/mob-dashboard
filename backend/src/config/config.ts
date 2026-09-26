import "dotenv/config";

const required = (key: string): string => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const optional = (key: string, fallback = ""): string => process.env[key] ?? fallback;

const bool = (key: string, fallback: boolean): boolean => {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

export type AppConfig = ReturnType<typeof loadConfig>;

const loadConfig = () => {
  const NODE_ENV = optional("NODE_ENV", "development");
  return {
    NODE_ENV,
    isProduction: NODE_ENV === "production",
    PORT: Number(optional("PORT", "8000")),
    TRUST_PROXY: bool("TRUST_PROXY", true),
    CORS_ORIGIN: optional("CORS_ORIGIN", "http://localhost:3000"),
    COOKIE_SECURE: bool("COOKIE_SECURE", NODE_ENV === "production"),

    db: loadDbConfig(),
    // Hosted/free databases often cap connections per user; lower this if you hit that limit.
    DB_POOL_SIZE: Number(optional("DB_POOL_SIZE", "5")),

    JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
    JWT_PASS_RESET_SECRET: required("JWT_PASS_RESET_SECRET"),

    SMTP_HOST: optional("SMTP_HOST"),
    SMTP_PORT: Number(optional("SMTP_PORT", "587")),
    SMTP_USER: optional("SMTP_USER"),
    SMTP_PASS: optional("SMTP_PASS"),
    SMTP_FROM: optional("SMTP_FROM"),

    ROOT_NAME: optional("ROOT_NAME", "Root"),
    ROOT_EMAIL: optional("ROOT_EMAIL"),
    ROOT_PASSWORD: optional("ROOT_PASSWORD"),

    ANURA_API_URL: optional("ANURA_API_URL", "https://api.anura.io/v1").replace(/\/+$/, ""),
    ANURA_API_TOKEN: optional("ANURA_API_TOKEN"),
    ANURA_INSTANCE_ID: optional("ANURA_INSTANCE_ID"),
    // "auto" tries JSON first, then form encoding, and remembers whichever Anura accepts.
    ANURA_BODY_FORMAT: optional("ANURA_BODY_FORMAT", "auto") as "auto" | "json" | "form",
    ANURA_CACHE_TTL_SECONDS: Number(optional("ANURA_CACHE_TTL_SECONDS", "15")),
  };
};

/**
 * Database connection from separate DB_* variables (the password is used exactly as written, so
 * characters like % @ : / need no escaping). DATABASE_URL is still accepted when DB_HOST is unset.
 */
function loadDbConfig() {
  if (!process.env.DB_HOST && process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    // A bare "%" in the password isn't valid URL encoding; keep it as typed.
    const decode = (v: string) => {
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    };
    return {
      host: url.hostname,
      port: Number(url.port || 3306),
      user: decode(url.username),
      password: decode(url.password),
      database: decode(url.pathname.replace(/^\//, "")),
    };
  }
  return {
    host: optional("DB_HOST", "localhost"),
    port: Number(optional("DB_PORT", "3306")),
    user: optional("DB_USER", "root"),
    password: optional("DB_PASSWORD"),
    database: optional("DB_NAME", "anura_dashboard"),
  };
}

let config: AppConfig | null = null;

export const getConfig = (): AppConfig => {
  if (!config) config = loadConfig();
  return config;
};
