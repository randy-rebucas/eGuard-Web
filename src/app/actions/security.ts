"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth";
import { toResult, type Result } from "@/lib/errors";
import * as twoFactor from "@/lib/two-factor";

/** Settings › Security › Two-step verification. Same rules as the mobile API's /me/two-factor. */

export async function startTwoStepSetup(): Promise<Result<{ secret: string; qr: string }>> {
  const u = await requireUser();
  return toResult(async () => {
    const { secret, uri } = await twoFactor.startSetup(u);
    // An SVG made here from the otpauth link: the secret never goes to a third-party QR service
    const qr = await QRCode.toString(uri, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b1b33", light: "#ffffff" } });
    return { secret, qr };
  });
}

export async function confirmTwoStepSetup(code: string): Promise<Result<{ recoveryCodes: string[] }>> {
  const u = await requireUser();
  return toResult(async () => {
    const r = await twoFactor.confirmSetup(u, String(code ?? ""));
    revalidatePath("/settings/security");
    return r;
  });
}

export async function turnOffTwoStep(code: string): Promise<Result> {
  const u = await requireUser();
  return toResult(async () => {
    await twoFactor.disable(u, String(code ?? ""));
    revalidatePath("/settings/security");
    return {};
  });
}

export async function newRecoveryCodes(code: string): Promise<Result<{ recoveryCodes: string[] }>> {
  const u = await requireUser();
  return toResult(async () => {
    const r = await twoFactor.regenerateRecoveryCodes(u, String(code ?? ""));
    revalidatePath("/settings/security");
    return r;
  });
}
