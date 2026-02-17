/**
 * SES-safe document head. Static import only; no Object.prototype or window at module load.
 * All DOM access in useEffect with try/catch. Replaces react-helmet-async for pipeline integrity.
 */
import React, { useEffect } from "react";

const DATA_SAFE_HEAD = "data-safe-head";

function safeSetTitle(title: string): void {
  try {
    if (typeof document !== "undefined" && document.title !== title) {
      document.title = title;
    }
  } catch (_) { /* ignore */ }
}

function safeQueryHead(): HTMLElement | null {
  try {
    if (typeof document === "undefined") return null;
    return document.head || document.querySelector("head");
  } catch {
    return null;
  }
}

function safeSetMeta(name: string, content: string, attr: "name" | "property" = "name"): void {
  const head = safeQueryHead();
  if (!head) return;
  try {
    const sel = `meta[${attr}="${name}"][${DATA_SAFE_HEAD}]`;
    let el = head.querySelector(sel) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, name);
      el.setAttribute(DATA_SAFE_HEAD, "true");
      head.appendChild(el);
    }
    if (el.getAttribute("content") !== content) {
      el.setAttribute("content", content);
    }
  } catch (_) { /* ignore */ }
}

function safeSetLink(rel: string, href: string): void {
  const head = safeQueryHead();
  if (!head) return;
  try {
    const sel = `link[rel="${rel}"][${DATA_SAFE_HEAD}]`;
    let el = head.querySelector(sel) as HTMLLinkElement | null;
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      el.setAttribute(DATA_SAFE_HEAD, "true");
      head.appendChild(el);
    }
    if (el.getAttribute("href") !== href) {
      el.setAttribute("href", href);
    }
  } catch (_) { /* ignore */ }
}

function safeSetScript(id: string, content: string, type = "application/ld+json"): void {
  const head = safeQueryHead();
  if (!head) return;
  try {
    let el = head.querySelector(`script#${id}`) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.setAttribute("type", type);
      el.id = id;
      el.setAttribute(DATA_SAFE_HEAD, "true");
      head.appendChild(el);
    }
    if (el.textContent !== content) {
      el.textContent = content;
    }
  } catch (_) { /* ignore */ }
}

function collectFromChildren(children: React.ReactNode): {
  title: string | null;
  meta: Array<{ name?: string; property?: string; content: string }>;
  link: Array<{ rel: string; href: string }>;
  script: Array<{ id: string; content: string; type: string }>;
} {
  const out = {
    title: null as string | null,
    meta: [] as Array<{ name?: string; property?: string; content: string }>,
    link: [] as Array<{ rel: string; href: string }>,
    script: [] as Array<{ id: string; content: string; type: string }>,
  };
  try {
    React.Children.forEach(children, (child) => {
      if (!child || typeof child !== "object" || !("type" in child) || !("props" in child)) return;
      const c = child as React.ReactElement<Record<string, unknown>>;
      const type = c.type as string;
      const props = c.props || {};
      if (type === "title" && typeof props.children === "string") {
        out.title = props.children;
        return;
      }
      if (type === "meta") {
        const name = props.name as string | undefined;
        const property = props.property as string | undefined;
        const content = props.content as string | undefined;
        if (content && (name || property)) {
          out.meta.push({ name, property, content });
        }
        return;
      }
      if (type === "link") {
        const rel = props.rel as string | undefined;
        const href = props.href as string | undefined;
        if (rel && href) out.link.push({ rel, href });
        return;
      }
      if (type === "script") {
        const scriptType = (props.type as string) || "application/ld+json";
        const raw = props.children;
        const content =
          typeof raw === "string"
            ? raw
            : Array.isArray(raw)
              ? raw.join("")
              : raw != null
                ? String(raw)
                : "";
        if (content) {
          out.script.push({ id: `safe-head-s${out.script.length}`, content, type: scriptType });
        }
      }
    });
  } catch (_) { /* ignore */ }
  return out;
}

export function SafeHead({ children }: { children?: React.ReactNode }) {
  useEffect(() => {
    if (!children) return;
    const { title, meta, link, script } = collectFromChildren(children);
    if (title) safeSetTitle(title);
    meta.forEach((m) => {
      const key = m.name ?? m.property ?? "";
      const attr = m.property ? "property" : "name";
      if (key) safeSetMeta(key, m.content, attr);
    });
    link.forEach((l) => safeSetLink(l.rel, l.href));
    script.forEach((s, i) => safeSetScript(s.id || `safe-head-s${i}`, s.content, s.type));
  }, [children]);
  return null;
}

export function SafeHeadProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
