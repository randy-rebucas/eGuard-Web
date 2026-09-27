import { NextResponse } from "next/server";
import { API_VERSION, open } from "@/lib/mobile-api";
import { audiencesFor } from "@/lib/social-auth";

/**
 * About eGuard, plus what the app needs before sign-in: API version, the oldest app version this
 * server supports (MOBILE_MIN_APP_VERSION), and which social sign-in buttons to show.
 */
export const GET = open(async () => NextResponse.json({
  name: "eGuard",
  apiVersion: API_VERSION,
  minimumAppVersion: process.env.MOBILE_MIN_APP_VERSION ?? "1.0.0",
  signIn: { password: true, apple: audiencesFor("apple").length > 0, google: audiencesFor("google").length > 0 },
  supportEmail: "support@eguard.example",
}));
