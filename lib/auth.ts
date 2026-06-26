export const AUTH_COOKIE_NAME = "knowledge_management_general_auth";
export const DEFAULT_APP_PASSWORD = "terracottalabs";

const AUTH_TOKEN_SALT = "knowledge_management_general:v1";

export function appPassword(): string {
  return process.env.APP_PASSWORD || DEFAULT_APP_PASSWORD;
}

export async function authToken(password = appPassword()): Promise<string> {
  const data = new TextEncoder().encode(`${AUTH_TOKEN_SALT}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function isAuthToken(value: string | undefined): Promise<boolean> {
  return Boolean(value) && value === (await authToken());
}
