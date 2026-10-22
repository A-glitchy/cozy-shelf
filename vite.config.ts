import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// For GitHub Pages the site lives at /<repo-name>/. Change the default below
// to match your repo, or set VITE_BASE at build time.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/cozy-shelf/",
  plugins: [react()],
});
