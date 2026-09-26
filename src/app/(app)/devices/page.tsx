import { requireUser } from "@/lib/auth";
import { getFamily, getFamilyGraph } from "@/lib/queries";
import { Avatar, EmptyState, PageHead } from "@/components/ui";
import { DeviceCard } from "@/components/cards";
import { PairDevice } from "@/components/forms";

export const metadata = { title: "Devices" };

export default async function DevicesPage() {
  const u = await requireUser();
  const family = await getFamily(u.familyId);
  const { children, devices, deviceStates } = await getFamilyGraph(u.familyId);
  return (
    <>
      <PageHead title="Devices" text={`${devices.length} of ${family.deviceLimit} devices on your plan. Each device reports its configuration back to eGuard when it syncs.`} />
      {children.map((c) => (
        <section key={c.id}>
          <div className="section-title"><h2 className="row" style={{ gap: 10 }}><Avatar name={c.name} hue={c.hue} />{c.name}&apos;s devices</h2></div>
          {c.devices.length ? (
            <div className="devices-grid">{c.devices.map((d) => <DeviceCard key={d.id} d={d} state={deviceStates[d.id]} tz={family.timezone} />)}</div>
          ) : (
            <div className="card"><EmptyState icon="smartphone" title={`No devices for ${c.name}`} text="Get a pairing code below and enter it in the eGuard app on their device." /></div>
          )}
        </section>
      ))}
      <section className="card card-pad" id="pair">
        <div className="card-head"><div><h2>Pair a device</h2><div className="sub">Install eGuard from Google Play or the App Store on your child&apos;s device, then enter a pairing code.</div></div></div>
        <PairDevice kids={children.map((c) => ({ id: c.id, name: c.name }))} />
      </section>
    </>
  );
}
