import { testMode } from "./storage.ts";
type SDK = {
  features: {
    LoadingAPI: { ready: () => void };
    GameplayAPI?: { start: () => void; stop: () => void };
  };
  on: (event: string, cb: () => void) => void;
  adv: {
    showRewardedVideo: (options: {
      callbacks: {
        onOpen: () => void;
        onRewarded: () => void;
        onClose: () => void;
        onError: () => void;
      };
    }) => void;
  };
};
declare global {
  interface Window {
    YaGames?: { init: () => Promise<SDK> };
  }
}
export class Platform {
  sdk: SDK | null = null;
  paused = false;
  ad = false;
  onChange = () => {};
  async init() {
    const environment = new URLSearchParams(location.search).get("platform");
    if (environment !== "yandex" && environment !== "yandex-custom") return;
    try {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          environment === "yandex"
            ? "/sdk.js"
            : "https://sdk.games.s3.yandex.net/sdk.js";
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.append(script);
      });
      this.sdk = await window.YaGames!.init();
      this.sdk.on("game_api_pause", () => {
        this.paused = true;
        this.onChange();
      });
      this.sdk.on("game_api_resume", () => {
        this.paused = false;
        this.onChange();
      });
      this.sdk.features.LoadingAPI.ready();
      this.onChange();
    } catch {
      this.sdk = null;
    }
  }
  gameplay(active: boolean) {
    const api = this.sdk?.features.GameplayAPI;
    if (active) api?.start();
    else api?.stop();
  }
  async rewarded(
    onReward: () => void,
    simulation = "unavailable",
  ): Promise<string> {
    if (!this.sdk && !testMode) return "unavailable";
    this.ad = true;
    this.onChange();
    if (!this.sdk) {
      try {
        if (simulation === "success") onReward();
        return simulation;
      } finally {
        this.ad = false;
        this.onChange();
      }
    }
    return new Promise((resolve) => {
      let rewarded = false;
      const end = (status: string) => {
        this.ad = false;
        this.onChange();
        resolve(status);
      };
      try {
        this.sdk!.adv.showRewardedVideo({
          callbacks: {
            onOpen: () => {
              this.ad = true;
              this.onChange();
            },
            onRewarded: () => {
              if (!rewarded) {
                rewarded = true;
                onReward();
              }
            },
            onClose: () => end(rewarded ? "success" : "cancel"),
            onError: () => end("error"),
          },
        });
      } catch {
        end("error");
      }
    });
  }
}
