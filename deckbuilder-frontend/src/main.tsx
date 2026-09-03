import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
//import './index.css'
import "./styles/layout.css";

import "./ui/tokens/spacing.module.css";
import "./ui/tokens/motion.module.css";
import "./ui/tokens/colors.module.css";
import "./ui/themes/premium.module.css";
import "./ui/density/airy.module.css";



import App from './App.tsx'

const queryClient = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>,
)
