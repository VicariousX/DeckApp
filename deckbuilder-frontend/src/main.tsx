import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

import "./ui/tokens/spacing.module.css";
import "./ui/tokens/motion.module.css";
import "./ui/tokens/colors.css";
import "./ui/themes/premium.css";
import "./ui/themes/arcane.css";
import "./ui/density/airy.module.css";
import "./ui/backgrounds/bg-hero.module.css";

import App from "./App.tsx";
import { AuthProvider } from "./auth/AuthProvider";
import { ThemeProvider } from "./theme/ThemeProvider";

const queryClient = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);
