/**
 * render-email.ts — Shared email rendering engine for sequencer-v2-tick and gmail-send.
 *
 * Consolidates duplicated template interpolation, text-to-HTML conversion,
 * click/open tracking injection, unsubscribe footer generation, and
 * RFC 2045 MIME message building.
 *
 * Usage:
 *   import { renderEmail, buildRawMimeMessage } from "../_shared/render-email.ts";
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RenderEmailParams {
  subjectTemplate: string;
  bodyTemplate: string;
  vars: Record<string, string>;
  trackingId: string;
  trackBase: string;
  unsubUrl?: string;
}

export interface MimeParams {
  from: string;
  fromName?: string;
  to: string;
  toName?: string;
  subject: string;
  plainBody: string;
  htmlBody: string;
  unsubUrl?: string;
  inReplyTo?: string;
  references?: string;
}

// ---------------------------------------------------------------------------
// 1. interpolateTemplate
// ---------------------------------------------------------------------------

/**
 * Replace `{{key}}` placeholders in a template string.
 * Supports both camelCase and snake_case variants for common vars.
 */
export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  // Build a lookup map that includes both camelCase and snake_case aliases
  const lookup: Record<string, string> = {};

  for (const [k, v] of Object.entries(vars)) {
    lookup[k] = v;
  }

  // Ensure common aliases are present in both forms
  const aliases: [string, string][] = [
    ["firstName", "first_name"],
    ["lastName", "last_name"],
    ["magicLink", "magic_link"],
    ["magicLink", "profile_url"],
    ["magicLink", "profileUrl"],
    ["company", "brokerage"],
  ];

  for (const [camel, snake] of aliases) {
    const value = lookup[camel] ?? lookup[snake] ?? undefined;
    if (value !== undefined) {
      lookup[camel] = value;
      lookup[snake] = value;
    }
  }

  // Also handle profile_url / profileUrl pointing to the same value as magicLink
  const magicVal = lookup["magicLink"] ?? lookup["magic_link"] ?? undefined;
  if (magicVal !== undefined) {
    lookup["profile_url"] = magicVal;
    lookup["profileUrl"] = magicVal;
  }

  const brokerageVal = lookup["company"] ?? lookup["brokerage"] ?? undefined;
  if (brokerageVal !== undefined) {
    lookup["company"] = brokerageVal;
    lookup["brokerage"] = brokerageVal;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return lookup[key] ?? _match; // leave unmatched placeholders intact
  });
}

// ---------------------------------------------------------------------------
// 2. textToHtml
// ---------------------------------------------------------------------------

/**
 * Convert plain text body to HTML suitable for email clients.
 * Handles markdown links, bare URLs, [[BLOCK]] containers, and newlines.
 */
export function textToHtml(text: string): string {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Convert markdown [text](url) to styled <a href> (blue, underlined)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" style="color:#2563eb;text-decoration:underline">$1</a>',
  );

  // Convert "click here: URL" to linked "click here"
  html = html.replace(
    /click here: (https?:\/\/[^\s]+)/g,
    '<a href="$1">click here</a>',
  );

  // Convert remaining bare URLs to links (skip those already inside an <a> tag)
  html = html.replace(
    /(https?:\/\/[^\s<]+)(?![^<]*<\/a>)/g,
    '<a href="$1">$1</a>',
  );

  // Convert [[BLOCK]]...[[/BLOCK]] to styled table box
  html = html.replace(
    /\[\[BLOCK\]\]\n?([\s\S]*?)\n?\[\[\/BLOCK\]\]/g,
    (_match, content) => {
      const inner = content.replace(/\n/g, "<br>");
      return `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;"><tr><td style="background:#f5f5f5;border:1px solid #ddd;border-radius:8px;padding:20px 24px;font-family:monospace;font-size:14px;line-height:1.6;color:#333;">${inner}</td></tr></table>`;
    },
  );

  // Convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

// ---------------------------------------------------------------------------
// 3. injectTracking
// ---------------------------------------------------------------------------

/** Regex for our own domain — these links are never rewritten. */
const OUR_DOMAIN = /^https?:\/\/(www\.)?top10lists\.us(\/|$)/i;

/**
 * Rewrite outbound links for click tracking and append an open-tracking pixel.
 */
export function injectTracking(
  html: string,
  trackingId: string,
  trackBase: string,
): string {
  // Rewrite href links for click tracking (skip our own domain)
  const tracked = html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (_match, url) => {
      if (OUR_DOMAIN.test(url)) return _match;
      const trackUrl = `${trackBase}?t=c&eid=${encodeURIComponent(trackingId)}&url=${encodeURIComponent(url)}`;
      return `href="${trackUrl}"`;
    },
  );

  // Append open tracking pixel
  const pixel = `<img src="${trackBase}?t=o&eid=${encodeURIComponent(trackingId)}" width="1" height="1" style="display:none" alt="">`;
  return tracked + pixel;
}

// ---------------------------------------------------------------------------
// 4. buildUnsubFooter
// ---------------------------------------------------------------------------

/**
 * Generate HTML and plain-text unsubscribe footers for a given URL.
 */
export function buildUnsubFooter(unsubUrl: string): {
  html: string;
  plain: string;
} {
  return {
    html: `<br><br><hr style="border:none;border-top:1px solid #ccc;margin-top:20px;"><p style="font-size:13px;color:#555;margin-top:12px;"><a href="${unsubUrl}" style="color:#555;text-decoration:underline;">Unsubscribe</a></p>`,
    plain: `\n\n---\nUnsubscribe: ${unsubUrl}`,
  };
}

// ---------------------------------------------------------------------------
// 5. renderEmail
// ---------------------------------------------------------------------------

/**
 * Orchestrate template interpolation, HTML conversion, unsub footer, and
 * tracking injection into a ready-to-send email payload.
 */
export function renderEmail(params: RenderEmailParams): {
  subject: string;
  htmlBody: string;
  plainBody: string;
} {
  const { subjectTemplate, bodyTemplate, vars, trackingId, trackBase, unsubUrl } = params;

  // 1. Interpolate templates
  const subject = interpolateTemplate(subjectTemplate, vars);
  const bodyInterpolated = interpolateTemplate(bodyTemplate, vars);

  // 2. Build plain body: strip [[BLOCK]] markers, append unsub footer
  let plainBody = bodyInterpolated
    .replace(/\[\[BLOCK\]\]\n?/g, "---\n")
    .replace(/\n?\[\[\/BLOCK\]\]/g, "\n---");

  if (unsubUrl) {
    const unsub = buildUnsubFooter(unsubUrl);
    plainBody += unsub.plain;
  }

  // 3. Convert body to HTML
  let htmlBody = textToHtml(bodyInterpolated);

  // 4. Append unsub HTML footer
  if (unsubUrl) {
    const unsub = buildUnsubFooter(unsubUrl);
    htmlBody += unsub.html;
  }

  // 5. Inject tracking (click rewrites + open pixel)
  htmlBody = injectTracking(htmlBody, trackingId, trackBase);

  return { subject, htmlBody, plainBody };
}

// ---------------------------------------------------------------------------
// 6. buildRawMimeMessage
// ---------------------------------------------------------------------------

/**
 * Build an RFC 2045 multipart/alternative MIME message and return it as a
 * base64url-encoded string ready for the Gmail API `raw` field.
 */
/**
 * Encode a UTF-8 string as base64, then wrap at 76 characters per line
 * per RFC 2045 Section 6.8.
 */
function base64Encode(text: string): string {
  const raw = btoa(unescape(encodeURIComponent(text)));
  // RFC 2045: max 76 characters per line
  return raw.match(/.{1,76}/g)?.join("\r\n") ?? raw;
}

/**
 * Quote a display name for email headers if it contains special characters.
 * RFC 5322: display names with specials must be quoted-string.
 */
function formatMailbox(email: string, displayName?: string): string {
  if (!displayName) return email;
  // Quote the display name if it contains specials (parens, commas, etc.)
  if (/[()<>@,;:\\".[\]]/.test(displayName)) {
    const escaped = displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}" <${email}>`;
  }
  return `${displayName} <${email}>`;
}

export function buildRawMimeMessage(params: MimeParams): string {
  const {
    from,
    fromName,
    to,
    toName,
    subject,
    plainBody,
    htmlBody,
    unsubUrl,
    inReplyTo,
    references,
  } = params;

  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const fromHeader = formatMailbox(from, fromName);
  const toHeader = formatMailbox(to, toName);

  const lines: string[] = [
    `From: ${fromHeader}`,
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];

  if (unsubUrl) lines.push(`List-Unsubscribe: <${unsubUrl}>`);
  if (inReplyTo) lines.push(`In-Reply-To: ${inReplyTo}`);
  if (references) lines.push(`References: ${references}`);

  lines.push(
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Encode(plainBody),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Encode(htmlBody),
    "",
    `--${boundary}--`,
  );

  const raw = lines.join("\r\n");

  // Base64url encode the entire message for Gmail API
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
