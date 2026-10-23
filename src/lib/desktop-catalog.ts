import type { AppCategory, DesktopCatalogKind, DesktopMatchType } from "@prisma/client";

/**
 * What the desktop agent knows before it scans a computer (docs/desktop-agent-spec.md, "Scanning installed apps"):
 * - GAME: always reported, as GAMES, under `displayName`, even when a trusted publisher signs it (Minecraft).
 * - TRUSTED_PUBLISHER: an Authenticode signer whose apps aren't reported or blocked (drivers, office, runtimes).
 * Anything else signed by a publisher that isn't trusted, or unsigned, is reported as from an unknown publisher.
 *
 * `match` is lower case. LAUNCHER_ID: "<kind>:<id>" as the agent's AppIds ("steam:730", "epic:fortnite",
 * "msstore:<package family name>"). EXE_NAME: the file name. SIGNER and PRODUCT_NAME: the whole name.
 * The database (DesktopCatalogEntry) is what the agent gets; this list seeds it (scripts/seed-desktop-catalog.ts), so a
 * new trending game is a database row, not an agent release.
 */
export type CatalogSeed = { kind: DesktopCatalogKind; matchType: DesktopMatchType; match: string; displayName?: string; category?: AppCategory; trending?: boolean };

type Game = { name: string; steam?: number; epic?: string; msstore?: string; exe?: string[]; signer?: string; trending?: boolean };

const GAMES: Game[] = [
  { name: "Counter-Strike 2", steam: 730, exe: ["cs2.exe"], trending: true },
  { name: "Roblox", exe: ["robloxplayerbeta.exe", "robloxplayerlauncher.exe"], signer: "roblox corporation", trending: true },
  { name: "Minecraft", exe: ["minecraft.exe", "minecraftlauncher.exe", "minecraft.windows.exe"], msstore: "microsoft.minecraftuwp_8wekyb3d8bbwe", trending: true },
  { name: "Fortnite", epic: "fortnite", exe: ["fortniteclient-win64-shipping.exe", "fortnitelauncher.exe"], trending: true },
  { name: "Valorant", exe: ["valorant-win64-shipping.exe", "valorant.exe"], trending: true },
  { name: "League of Legends", exe: ["league of legends.exe", "leagueclient.exe"], trending: true },
  { name: "Dota 2", steam: 570, exe: ["dota2.exe"], trending: true },
  { name: "PUBG: Battlegrounds", steam: 578080, exe: ["tslgame.exe"], trending: true },
  { name: "Apex Legends", steam: 1172470, exe: ["r5apex.exe", "r5apex_dx12.exe"], trending: true },
  { name: "Marvel Rivals", steam: 2767030, exe: ["marvel-win64-shipping.exe"], trending: true },
  { name: "Grand Theft Auto V", steam: 271590, exe: ["gta5.exe", "gta5_enhanced.exe"], trending: true },
  { name: "Rust", steam: 252490, exe: ["rustclient.exe"], trending: true },
  { name: "Genshin Impact", exe: ["genshinimpact.exe", "yuanshen.exe"], trending: true },
  { name: "Honkai: Star Rail", exe: ["starrail.exe"], trending: true },
  { name: "Call of Duty", steam: 1938090, exe: ["cod.exe", "cod24-cod.exe"], trending: true },
  { name: "Overwatch 2", steam: 2357570, exe: ["overwatch.exe"], trending: true },
  { name: "Rocket League", steam: 252950, epic: "sugar", exe: ["rocketleague.exe"], trending: true },
  { name: "Fall Guys", exe: ["fallguys_client_game.exe"], trending: true },
  { name: "Delta Force", steam: 2507950, exe: ["deltaforceclient-win64-shipping.exe"], trending: true },
  { name: "Palworld", steam: 1623730, exe: ["palworld-win64-shipping.exe"] },
  { name: "Helldivers 2", steam: 553850, exe: ["helldivers2.exe"] },
  { name: "Lethal Company", steam: 1966720, exe: ["lethal company.exe"] },
  { name: "Baldur's Gate 3", steam: 1086940, exe: ["bg3.exe", "bg3_dx11.exe"] },
  { name: "Elden Ring", steam: 1245620, exe: ["eldenring.exe"] },
  { name: "Terraria", steam: 105600, exe: ["terraria.exe"] },
  { name: "Among Us", steam: 945360, exe: ["among us.exe"] },
  { name: "Team Fortress 2", steam: 440, exe: ["tf_win64.exe", "tf.exe"] },
  { name: "Rainbow Six Siege", steam: 359550, exe: ["rainbowsix.exe", "rainbowsix_vulkan.exe"] },
  { name: "Dead by Daylight", steam: 381210, exe: ["deadbydaylight-win64-shipping.exe"] },
  { name: "Warframe", steam: 230410, exe: ["warframe.x64.exe"] },
  { name: "Geometry Dash", steam: 322170, exe: ["geometrydash.exe"] },
  { name: "Stumble Guys", steam: 1677740, exe: ["stumble guys.exe"] },
  { name: "World of Warcraft", exe: ["wow.exe"] },
  { name: "Hearthstone", exe: ["hearthstone.exe"] },
  { name: "The Sims 4", steam: 1222670, exe: ["ts4_x64.exe"] },
  { name: "osu!", exe: ["osu!.exe"] },
  { name: "Microsoft Solitaire Collection", msstore: "microsoft.microsoftsolitairecollection_8wekyb3d8bbwe" },
  // Launchers and stores: games themselves, and where the agent looks for more
  { name: "Steam", exe: ["steam.exe"] },
  { name: "Epic Games Launcher", exe: ["epicgameslauncher.exe"] },
  { name: "Riot Client", exe: ["riotclientservices.exe", "riotclientux.exe"] },
  { name: "Battle.net", exe: ["battle.net.exe"] },
  { name: "EA app", exe: ["eadesktop.exe"] },
  { name: "Ubisoft Connect", exe: ["upc.exe", "ubisoftconnect.exe"] },
  { name: "GOG Galaxy", exe: ["galaxyclient.exe"] },
  { name: "itch", exe: ["itch.exe"] },
  { name: "Xbox", msstore: "microsoft.gamingapp_8wekyb3d8bbwe" },
];

/** Signers of drivers, office suites, runtimes and system tools: not reported, never blocked. */
const TRUSTED_PUBLISHERS = [
  "microsoft corporation", "microsoft windows", "microsoft windows publisher", "google llc", "adobe inc.", "intel corporation",
  "nvidia corporation", "advanced micro devices, inc.", "realtek semiconductor corp.", "dell inc", "hp inc.", "lenovo",
  "asustek computer inc.", "acer incorporated", "apple inc.", "mozilla corporation", "zoom video communications, inc.",
  "oracle america, inc.", "logitech inc", "dropbox, inc", "cisco webex llc", "qualcomm technologies, inc.", "synaptics incorporated",
  "elan microelectronics corp.", "dolby laboratories, inc.", "waves inc", "python software foundation", "the document foundation",
  // Printers and monitors' companion apps. "intel corp" is how the Store names Intel (Graphics Command Center); Zoom
  // signs with its newer name too
  "seiko epson corporation", "lg electronics inc.", "intel corp", "zoom communications, inc.",
];

export const DESKTOP_CATALOG: CatalogSeed[] = [
  ...GAMES.flatMap((g) => {
    const game = { kind: "GAME" as const, displayName: g.name, category: "GAMES" as const, trending: g.trending ?? false };
    return [
      ...(g.steam ? [{ ...game, matchType: "LAUNCHER_ID" as const, match: `steam:${g.steam}` }] : []),
      ...(g.epic ? [{ ...game, matchType: "LAUNCHER_ID" as const, match: `epic:${g.epic}` }] : []),
      ...(g.msstore ? [{ ...game, matchType: "LAUNCHER_ID" as const, match: `msstore:${g.msstore}` }] : []),
      ...(g.exe ?? []).map((exe) => ({ ...game, matchType: "EXE_NAME" as const, match: exe })),
      ...(g.signer ? [{ ...game, matchType: "SIGNER" as const, match: g.signer }] : []),
    ];
  }),
  ...TRUSTED_PUBLISHERS.map((match) => ({ kind: "TRUSTED_PUBLISHER" as const, matchType: "SIGNER" as const, match })),
];
