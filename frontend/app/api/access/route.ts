import { NextResponse } from "next/server";

const ACCESS_COOKIE = "bdns-team-access";
const ACCESS_SALT = "blockdns-team-v1";

async function accessToken(password: string) {
  const data = new TextEncoder().encode(`${ACCESS_SALT}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const configuredPassword = process.env.TEAM_ACCESS_PASSWORD;
  if (!configuredPassword) {
    return NextResponse.json({ error: "Team password is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.password !== "string" || body.password !== configuredPassword) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACCESS_COOKIE, await accessToken(configuredPassword), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
