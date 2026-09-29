import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { listBrowsers } from "@/lib/browser-service";
import { Avatar, EmptyState, PageHead } from "@/components/ui";
import { BrowserCard, DeviceCard } from "@/components/cards";
import { PairDevice } from "@/components/forms";

export const metadata = { title: "Devices" };

export default async function DevicesPage() {
  const u = await requireUser();
  const [family, { children, devices, deviceStates }, browsers] = await Promise.all([
    getFamily(u.familyId), getFamilyGraph(u.familyId), listBrowsers(u.familyId),
  ]);
  // Browsers take a device slot, except one eGuard disconnected for security
  const used = devices.length + browsers.filter((b) => !b.revokedAt).length;
  const kids = children.map((c) => ({ id: c.id, name: c.name }));
  return (
    <>
      <PageHead title="Devices" text={used > family.deviceLimit
        ? `${used} devices, more than the ${family.deviceLimit} your plan covers now. They stay protected; remove some or change your plan to add more.`
        : `${used} of ${family.deviceLimit} devices on your plan, counting browsers. Each device reports its configuration back to eGuard when it syncs.`} />
      {children.map((c) => {
        const own = browsers.filter((b) => b.childId === c.id);
        return (
          <section key={c.id}>
            <div className="section-title"><h2 className="row" style={{ gap: 10 }}><Avatar name={c.name} hue={c.hue} />{c.name}&apos;s devices</h2></div>
            {c.devices.length || own.length ? (
              <div className="devices-grid">
                {c.devices.map((d) => <DeviceCard key={d.id} d={d} state={deviceStates[d.id]} tz={family.timezone} />)}
                {own.map((b) => <BrowserCard key={b.id} b={b} tz={family.timezone} />)}
              </div>
            ) : (
              <div className="card"><EmptyState icon="smartphone" title={`No devices for ${c.name}`} text="Get a pairing code below and enter it in the eGuard app on their device, or in the eGuard browser extension." /></div>
            )}
          </section>
        );
      })}
      <section className="card card-pad" id="pair">
        <div className="card-head"><div><h2>Pair a device</h2><div className="sub">Install eGuard from Google Play or the App Store on your child&apos;s device, then enter a pairing code.</div></div></div>
        <PairDevice kids={kids} used={used} limit={family.deviceLimit} />
      </section>
      <section className="card card-pad" id="add-browser">
        <div className="card-head"><div><h2>Add a browser</h2><div className="sub">For your child&apos;s computer: the eGuard extension for Chrome, Edge or Firefox. Name the computer, then enter the code in the extension.</div></div></div>
        <PairDevice kids={kids} used={used} limit={family.deviceLimit} kind="BROWSER" />
      </section>
    </>
  );
}
