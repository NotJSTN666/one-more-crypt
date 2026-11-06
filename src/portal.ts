// Builds for game portals (npm run build:crazygames). The portal version is the same game with
// everything that points off-site taken out (support links, follow buttons, links to the game's
// own website, app installs, push reminders) and no sign-in but guest names, as the portal asks;
// and on CrazyGames it reports loading and gameplay to the CrazyGames SDK.

/** Running as the CrazyGames build. */
export const PORTAL = import.meta.env.MODE === 'crazygames';

interface CrazySDK {
  init(): Promise<void>;
  game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    settings?: { muteAudio?: boolean };
    addSettingsChangeListener?(cb: (s: { muteAudio?: boolean }) => void): void;
  };
}

let sdk: CrazySDK | null = null;
let playing = false;
let loaded = false;

const crazy = (): CrazySDK | null => (window as unknown as { CrazyGames?: { SDK?: CrazySDK } }).CrazyGames?.SDK ?? null;

/** Start the SDK as the game loads. `mute` is told whenever the portal wants the sound off or back on. */
export async function initPortal(mute: (on: boolean) => void): Promise<void> {
  if (!PORTAL) return;
  try {
    const s = crazy();
    if (!s) return;
    await s.init();
    sdk = s;
    sdk.game.loadingStart();
    if (sdk.game.settings?.muteAudio) mute(true);
    sdk.game.addSettingsChangeListener?.((st) => mute(Boolean(st.muteAudio)));
  } catch {
    sdk = null;
  }
}

/** The game has loaded (the title is up). */
export function portalLoaded() {
  if (!sdk || loaded) return;
  loaded = true;
  try {
    sdk.game.loadingStop();
  } catch {
    // ignore
  }
}

/** A run (or a night) is under way, or has stopped (ended, paused, or left for a menu). */
export function portalPlaying(on: boolean) {
  if (!sdk || on === playing) return;
  playing = on;
  try {
    if (on) sdk.game.gameplayStart();
    else sdk.game.gameplayStop();
  } catch {
    // ignore
  }
}

/** A big moment (a new best, a boss down, dawn): the portal celebrates. Use sparingly. */
export function portalHappy() {
  if (!sdk) return;
  try {
    sdk.game.happytime();
  } catch {
    // ignore
  }
}
