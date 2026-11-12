import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  workers: 1,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5173", headless: true },
  projects: [
    {
      name: "firefox",
      testIgnore: "**/touch.spec.ts",
      use: { browserName: "firefox" },
    },
    {
      name: "chromium",
      testIgnore: "**/touch.spec.ts",
      use: { browserName: "chromium" },
    },
    {
      name: "touch",
      testMatch: "**/touch.spec.ts",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: "npm.cmd run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
  },
});
