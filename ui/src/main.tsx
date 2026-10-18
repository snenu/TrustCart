import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/plus-jakarta-sans/wght-italic.css";
import App from "./App";
import "./styles.css";

// Midnight's browser bundles assume the Node Buffer polyfill is globally
// reachable. Assigned through a narrow cast so type-checking does not depend
// on @types/node being resolvable in a given environment.
(globalThis as { Buffer?: unknown }).Buffer = Buffer;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
