import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { toast as shadToast } from "@/hooks/use-toast";

// Lightweight wrapper to provide a Sonner-like API using shadcn/ui toasts.
// This avoids runtime issues while keeping existing `toast.*` calls working.

type Message = string | { title?: string; description?: string };

function toTitleAndDesc(msg: Message): { title?: string; description?: string } {
  if (typeof msg === "string") return { title: msg };
  return { title: msg.title, description: msg.description };
}

const baseToast = (msg: Message) => {
  const { title, description } = toTitleAndDesc(msg);
  shadToast({ title, description });
};

const success = (msg: Message) => {
  const { title, description } = toTitleAndDesc(msg);
  shadToast({ title: title ?? "Success", description });
};

const error = (msg: Message) => {
  const { title, description } = toTitleAndDesc(msg);
  shadToast({ title: title ?? "Error", description, variant: "destructive" as any });
};

const info = (msg: Message) => baseToast(msg);
const warning = (msg: Message) => {
  const { title, description } = toTitleAndDesc(msg);
  shadToast({ title: title ?? "Warning", description });
};

// Export a toast object compatible with common Sonner usage patterns
export const toast = Object.assign(baseToast, { success, error, info, warning });

// Re-export Toaster so existing imports keep working
export const Toaster = ShadcnToaster;
