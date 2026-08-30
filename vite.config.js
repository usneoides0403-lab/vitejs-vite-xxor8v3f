import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // テクスチャ画像を JS に埋め込む（1枚のHTMLとして配れるようにするため）
    assetsInlineLimit: 20 * 1024 * 1024,
    chunkSizeWarningLimit: 4000,
  },
});
