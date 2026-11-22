import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  envDir: mode === "test" ? "./src/test" : ".",
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
}));
