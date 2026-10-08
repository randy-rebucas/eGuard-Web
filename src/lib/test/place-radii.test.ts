import { describe, expect, it } from "vitest";
import { parseLatLng } from "../place-radii";

describe("parseLatLng", () => {
  it("reads coordinates as maps apps copy them", () => {
    expect(parseLatLng("14.6507, 121.0494")).toEqual({ lat: 14.6507, lng: 121.0494 });
    expect(parseLatLng(" -33.8688 151.2093 ")).toEqual({ lat: -33.8688, lng: 151.2093 });
    expect(parseLatLng("14,121")).toEqual({ lat: 14, lng: 121 });
  });
  it("refuses what isn't a point on Earth", () => {
    for (const s of ["", "14.65", "abc, def", "91, 0", "0, 181", "14.6, 121.0, 5", "1e2, 3"]) expect(parseLatLng(s)).toBeNull();
  });
});
