import { Toaster as SonnerPrimitive, toast as sonnerToast } from "sonner";

// Re-export Sonner's Toaster component
export const Toaster = SonnerPrimitive;

// Re-export toast with proper API
export const toast = sonnerToast;
