import { Toaster as SonnerToaster } from "sonner";

// Sonner Toaster - required for toast() calls from "sonner" to display.
export function Toaster() {
  return <SonnerToaster position="top-center" richColors closeButton />;
}
