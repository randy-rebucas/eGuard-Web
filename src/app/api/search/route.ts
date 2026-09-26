import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PROTECTIONS } from "@/lib/protections";

const SETTINGS = [
  ["account", "Account"], ["family", "Family members"], ["notifications", "Notification settings"], ["privacy", "Privacy controls"],
  ["security", "Security & two-step verification"], ["subscription", "Subscription"], ["devices", "Connected devices"],
  ["integrations", "Platform integrations"], ["data", "Export or delete data"], ["support", "Support"],
] as const;

export async function GET(req: Request) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ results: [] });
  const ci = { contains: q, mode: "insensitive" as const };
  const [children, devices, alerts] = await Promise.all([
    db.child.findMany({ where: { familyId: u.familyId, name: ci }, take: 5 }),
    db.device.findMany({ where: { familyId: u.familyId, OR: [{ name: ci }, { model: ci }, { osVersion: ci }, { child: { name: ci } }] }, include: { child: true }, take: 6 }),
    db.alert.findMany({ where: { familyId: u.familyId, OR: [{ title: ci }, { subject: ci }] }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  const ql = q.toLowerCase();
  const results = [
    ...children.map((c) => ({ group: "Children", icon: "user", title: c.name, sub: `Child · ${new Date().getFullYear() - c.birthYear} years old`, href: `/children/${c.id}` })),
    ...devices.map((d) => ({ group: "Devices", icon: d.kind === "TABLET" ? "tablet" : "smartphone", title: d.name, sub: `${d.child.name} · ${d.osVersion}`, href: `/devices/${d.id}` })),
    ...PROTECTIONS.filter((p) => p.name.toLowerCase().includes(ql) || p.checkName.toLowerCase().includes(ql))
      .map((p) => ({ group: "Protection policies", icon: p.icon, title: p.checkName, sub: "Protection", href: `/protection#${p.slug}` })),
    ...alerts.map((a) => ({ group: "Alerts", icon: a.icon, title: a.title, sub: a.subject, href: `/notifications` })),
    ...SETTINGS.filter(([, l]) => l.toLowerCase().includes(ql)).map(([k, l]) => ({ group: "Settings", icon: "settings", title: l, sub: "Settings", href: `/settings/${k}` })),
  ].slice(0, 12);
  return NextResponse.json({ results });
}
