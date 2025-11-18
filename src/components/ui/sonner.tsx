import React from "react";

type Message = string | { title?: string; description?: string };

// Minimal no-op Toaster to avoid runtime hook issues
export function Toaster() {
  return null;
}

function baseToast(msg: Message) {
  if (typeof msg === "string") {
    console.log("toast:", msg);
  } else {
    console.log("toast:", msg.title ?? "", msg.description ?? "");
  }
}

const success = (msg: Message) => baseToast(msg);
const error = (msg: Message) => baseToast(msg);
const info = (msg: Message) => baseToast(msg);
const warning = (msg: Message) => baseToast(msg);

export const toast = Object.assign(baseToast, { success, error, info, warning });
