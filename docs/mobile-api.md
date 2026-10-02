# eGuard Mobile APIs — v1

eGuard's phone apps talk to two separate APIs, one per side of the family. They use different credentials and
neither accepts the other's token.

| | Parent app | Child device app |
|---|---|---|
| Reference | **[mobile-api-parent.md](mobile-api-parent.md)** | **[mobile-api-child.md](mobile-api-child.md)** |
| Base URL | `https://www.eguard.family/api/mobile/v1` | `https://www.eguard.family/api/device/v1` |
| Who uses it | A parent, signed in | The eGuard app on the child's phone or tablet |
| Credential | Session token from sign-in (30 days) | Device token from pairing (until the device is removed) |
| Does | Dashboard, children, protections, screen time, apps, location, alerts, devices, family, subscription, help | Pair, sync policy and changes, report the real configuration, send screen time, location and events |
| Product spec | Design screens (screen map in §3 of the reference) | [child-app-spec.md](child-app-spec.md) |

The two meet at pairing: the parent app creates a code (`POST /children/{id}/pairing-code`) and the child app
exchanges it for a device token (`POST /pair`). After that, a parent's change travels as a configuration request
that the device applies and reports back, and only the device's report marks it verified.

Related: [browser-extension-api.md](browser-extension-api.md) (the eGuard extension in the child's browser),
[mobile-organizations.md](mobile-organizations.md) (one app with both modes, plus organizations).
