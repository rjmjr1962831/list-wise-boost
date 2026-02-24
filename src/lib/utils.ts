import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Exclude generic "listing agent" / "buyer's agent" (and derivatives) from displayed specialties. */
export function filterSpecialties(specs: string[] | null | undefined): string[] {
  const arr = Array.isArray(specs) ? specs : [];
  return arr.filter((s: string) => {
    const n = String(s).toLowerCase().replace(/'/g, "").replace(/\s+/g, "");
    return n !== "listingagent" && n !== "listingagents" && n !== "listingsagent" &&
      n !== "buyeragent" && n !== "buyersagent" && n !== "buyeragents" && n !== "buyersagents" &&
      !n.startsWith("listingagent") && !n.startsWith("buyeragent") && !n.startsWith("buyersagent");
  });
}
