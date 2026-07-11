import { defineConfig } from "@playwright/test";
import fs from "node:fs";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3002";
const chromePath =
  process.env.PLAYWRIGHT_CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 1000 },
    launchOptions: fs.existsSync(chromePath)
      ? {
          executablePath: chromePath,
        }
      : undefined,
  },
});
