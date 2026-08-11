import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev
export default defineConfig({
  base: "/pulse-logistics-pro/", // ADICIONE ESTA LINHA EXATAMENTE AQUI
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
