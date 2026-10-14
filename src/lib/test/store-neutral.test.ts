import { describe, expect, it } from "vitest";
import { APPS_UPGRADE, KEEP_PLAN, forClient, storeNeutral } from "../store-neutral";

describe("storeNeutral", () => {
  it("drops sentences about buying a plan and leaves the rest readable", () => {
    expect(storeNeutral(`An app was installed. ${APPS_UPGRADE}`)).toBe("An app was installed.");
    expect(storeNeutral(`After that your family goes back to Free. Children and devices already added stay protected. ${KEEP_PLAN}`))
      .toBe("After that your family goes back to Free. Children and devices already added stay protected.");
  });
  it("changes nothing for the web and Android", () => {
    const t = `Mia tried to open a blocked app. ${APPS_UPGRADE}`;
    expect(forClient(t, false)).toBe(t);
    expect(forClient(t, true)).toBe("Mia tried to open a blocked app.");
  });
  it("leaves other text alone", () => {
    expect(storeNeutral("Bedtime was changed on the device.")).toBe("Bedtime was changed on the device.");
  });
});
