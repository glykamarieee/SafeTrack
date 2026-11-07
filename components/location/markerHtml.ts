// Web markers as HTML, shared by the Google Maps JavaScript engine and the
// Leaflet fallback, so both look like the native markers in MarkerGlyph.tsx.

import { RING_COLORS, type MapMarker } from "./mapTypes";

export type MarkerHtml = { html: string; width: number; height: number; anchorX: number; anchorY: number };

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!,
  );
}

function safeUrl(value?: string | null) {
  return value && /^https:\/\//.test(value) ? value : null;
}

const ICONS: Record<string, string> = {
  smartwatch:
    '<svg viewBox="0 0 24 24"><path d="M9 2h6l1 4a6 6 0 010 12l-1 4H9l-1-4a6 6 0 010-12l1-4zm3 6a4 4 0 100 8 4 4 0 000-8z"/></svg>',
  mobile:
    '<svg viewBox="0 0 24 24"><path d="M8 2h8a2 2 0 012 2v16a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2zm0 3v13h8V5H8z"/></svg>',
  "warning":
    '<svg viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2zm-1 7h2v6h-2V9zm0 8h2v2h-2v-2z"/></svg>',
  "shield-checkmark":
    '<svg viewBox="0 0 24 24"><path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3zm-1.5 14L7 12.5l1.4-1.4 2.1 2.1 5.1-5.1L17 9.5 10.5 16z"/></svg>',
  "exit":
    '<svg viewBox="0 0 24 24"><path d="M5 3h9v2H5v14h9v2H5a2 2 0 01-2-2V5a2 2 0 012-2zm11 4 5 5-5 5-1.4-1.4 2.6-2.6H9v-2h8.2l-2.6-2.6L16 7z"/></svg>',
  "enter":
    '<svg viewBox="0 0 24 24"><path d="M19 3h-9v2h9v14h-9v2h9a2 2 0 002-2V5a2 2 0 00-2-2zM10 7l-1.4 1.4 2.6 2.6H3v2h8.2l-2.6 2.6L10 17l5-5-5-5z"/></svg>',
  "analytics":
    '<svg viewBox="0 0 24 24"><path d="M4 19h16v2H4v-2zm1-8h3v6H5v-6zm5-6h3v12h-3V5zm5 4h3v8h-3V9z"/></svg>',
  "watch":
    '<svg viewBox="0 0 24 24"><path d="M9 2h6l1 4a6 6 0 010 12l-1 4H9l-1-4a6 6 0 010-12l1-4zm3 6a4 4 0 100 8 4 4 0 000-8z"/></svg>',
  "hourglass":
    '<svg viewBox="0 0 24 24"><path d="M6 2h12v5l-4 5 4 5v5H6v-5l4-5-4-5V2zm2 2v2.3L12 11l4-4.7V4H8z"/></svg>',
};

// Activity badge (native uses MaterialCommunityIcons). Stroke icons, drawn white.
const MODE_ICONS: Record<string, string> = {
  still: '<svg viewBox="0 0 24 24"><circle cx="12" cy="4.5" r="2.2"/><path d="M12 8v7m0 0-2 6m2-6 2 6M8 10.5h8"/></svg>',
  walking:
    '<svg viewBox="0 0 24 24"><circle cx="13" cy="4" r="2.2"/><path d="M12.5 8 10.5 14l-3 6M10.5 14l3.5 3 1 4M11.5 10 8 12.5M12.5 9l3.5 3"/></svg>',
  running:
    '<svg viewBox="0 0 24 24"><circle cx="15.5" cy="4" r="2.2"/><path d="M14.5 8 11 13H6.5M11 13l3 4-2 4.5M14 17h4.5M14.5 8.5l4 3M13.5 8.5 9 10"/></svg>',
  vehicle:
    '<svg viewBox="0 0 24 24"><path d="M3.5 16v-3.5L6 7h12l2.5 5.5V16zM3.5 12.5h17"/><circle cx="7.5" cy="16.5" r="1.8"/><circle cx="16.5" cy="16.5" r="1.8"/></svg>',
  boat: '<svg viewBox="0 0 24 24"><path d="M3 14h18l-3 5H6zM12 4v10M12 5l5 6h-5"/></svg>',
};

/** Ionicons names used by the native markers, mapped to the inline icons above. */
function iconSvg(name?: string) {
  if (!name) return "";
  const key = name.replace(/-outline$/, "");
  if (key.startsWith("warning")) return ICONS.warning;
  if (key.startsWith("shield")) return ICONS["shield-checkmark"];
  if (key.startsWith("exit") || key.startsWith("log-out")) return ICONS.exit;
  if (key.startsWith("enter") || key.startsWith("log-in")) return ICONS.enter;
  if (key.startsWith("analytics")) return ICONS.analytics;
  if (key.startsWith("watch")) return ICONS.watch;
  if (key.startsWith("hourglass")) return ICONS.hourglass;
  return "";
}

/** A left footprint pointing up (the right one is mirrored); the map rotates it. */
export const FOOT_SVG = {
  walk:
    '<svg viewBox="0 0 24 24"><g class="st-foot-shape"><ellipse cx="11.3" cy="19.2" rx="2.8" ry="3"/><path d="M8.7 18.8 8.1 12h6.3l-1.5 3.6 1 3.4z"/><ellipse cx="11.3" cy="10.4" rx="4" ry="3.7"/><ellipse cx="14" cy="4.9" rx="1.5" ry="1.7"/><ellipse cx="11.6" cy="4.3" rx="1.1" ry="1.3"/><ellipse cx="9.7" cy="4.7" rx="1" ry="1.15"/><ellipse cx="8.2" cy="5.4" rx=".9" ry="1"/><ellipse cx="7" cy="6.5" rx=".75" ry=".85"/></g></svg>',
  run: '<svg viewBox="0 0 24 24"><g class="st-foot-shape"><ellipse cx="11.5" cy="18.7" rx="3.1" ry="3.6"/><path d="M8.4 18.7 7.9 9.6h7.5l-1 9.1z"/><ellipse cx="11.6" cy="7.2" rx="4" ry="4.8"/></g><g class="st-foot-tread"><rect x="9" y="5.3" width="5.6" height=".9" rx=".45"/><rect x="9" y="7.4" width="5.6" height=".9" rx=".45"/><rect x="9" y="9.5" width="5.6" height=".9" rx=".45"/><rect x="9.6" y="17.4" width="4" height=".9" rx=".45"/><rect x="9.6" y="19.5" width="4" height=".9" rx=".45"/></g></svg>',
};

export function markerHtml(marker: MapMarker): MarkerHtml {
  const offset = marker.offsetX ?? 0;

  switch (marker.kind) {
    case "child":
    case "guardian": {
      // The avatar's centre is the person's position; the direction layer
      // (.st-dir) is turned by the map page, the short way round.
      const ring = RING_COLORS[marker.ring ?? "neutral"];
      const tint = marker.kind === "guardian" ? "#1A73E8" : ring;
      const photo = safeUrl(marker.photoUrl);
      const face = photo
        ? `<img class="st-av-photo" src="${esc(photo)}" alt="" draggable="false" referrerpolicy="no-referrer" onerror="this.remove()"/><div class="st-av-initials" style="background:${esc(marker.color ?? "#15803D")}">${esc(marker.initials ?? "?")}</div>`
        : `<div class="st-av-initials" style="background:${esc(marker.color ?? "#15803D")}">${esc(marker.initials ?? "?")}</div>`;
      const source = marker.source && ICONS[marker.source] ? `<div class="st-av-source">${ICONS[marker.source]}</div>` : "";
      const battery =
        marker.batteryPercent != null
          ? `<div class="st-av-battery${marker.batteryPercent <= 20 ? " low" : ""}">${Math.round(marker.batteryPercent)}%</div>`
          : "";
      const label = marker.label ? `<div class="st-av-label${marker.kind === "guardian" ? " me" : ""}">${esc(marker.label)}</div>` : "";
      const mode =
        marker.mode && MODE_ICONS[marker.mode]
          ? `<div class="st-av-mode" data-mode="${esc(marker.mode)}" title="${esc(marker.mode)}">${MODE_ICONS[marker.mode]}</div>`
          : "";
      const direction = `<div class="st-dir${marker.headingDegrees == null ? " off" : ""}" style="--tint:${tint}"><div class="st-dir-cone"></div><svg class="st-dir-arrow" viewBox="0 0 92 92"><path d="M46 1 56 17 46 12.5 36 17Z"/></svg></div>`;

      return {
        html: `<div class="st-person${marker.ring === "sos" ? " sos" : ""}" style="--ring:${ring}">${direction}${marker.ring === "sos" ? '<div class="st-av-halo"></div>' : ""}<div class="st-av-ring">${face}</div>${source}${mode}${battery}${label}</div>`,
        width: 92,
        height: marker.label ? 112 : 92,
        anchorX: 46 - offset,
        anchorY: 46,
      };
    }
    case "replay": {
      const ring = RING_COLORS[marker.ring ?? "neutral"];
      const photo = safeUrl(marker.photoUrl);
      const face = photo
        ? `<img class="st-av-photo" src="${esc(photo)}" alt="" draggable="false" referrerpolicy="no-referrer" onerror="this.remove()"/><div class="st-av-initials" style="background:${esc(marker.color ?? "#15803D")}">${esc(marker.initials ?? "?")}</div>`
        : `<div class="st-av-initials" style="background:${esc(marker.color ?? "#15803D")}">${esc(marker.initials ?? "?")}</div>`;
      const source = marker.source && ICONS[marker.source] ? `<div class="st-av-source">${ICONS[marker.source]}</div>` : "";
      const battery =
        marker.batteryPercent != null
          ? `<div class="st-av-battery${marker.batteryPercent <= 20 ? " low" : ""}">${Math.round(marker.batteryPercent)}%</div>`
          : "";
      const label = marker.label ? `<div class="st-av-label">${esc(marker.label)}</div>` : "";
      const mode =
        marker.mode && MODE_ICONS[marker.mode]
          ? `<div class="st-av-mode" data-mode="${esc(marker.mode)}" title="${esc(marker.mode)}">${MODE_ICONS[marker.mode]}</div>`
          : "";
      const height = marker.label ? 84 : 66;

      return {
        html: `<div class="st-av${marker.ring === "sos" ? " sos" : ""}${marker.kind === "replay" ? " replay" : ""}" style="--ring:${ring}">${marker.ring === "sos" ? '<div class="st-av-halo"></div>' : ""}<div class="st-av-ring">${face}</div><div class="st-av-pointer"></div>${source}${mode}${battery}${label}</div>`,
        width: 64,
        height,
        anchorX: 32 - offset,
        anchorY: 58,
      };
    }
    case "start":
      return { html: '<div class="st-start"></div>', width: 22, height: 22, anchorX: 11, anchorY: 11 };
    case "stop":
      return { html: `<div class="st-stop">${esc(marker.label ?? "")}</div>`, width: 28, height: 28, anchorX: 14, anchorY: 14 };
    case "event":
      return {
        html: `<div class="st-event" style="background:${esc(marker.tint ?? "#15803D")}">${iconSvg(marker.icon)}</div>`,
        width: 30,
        height: 30,
        anchorX: 15,
        anchorY: 15,
      };
    case "zoneCenter":
      return {
        html: `<div class="st-zone"><div class="st-zone-dot" style="background:${esc(marker.tint ?? "#22B35E")}"></div><div class="st-zone-chip">${esc(marker.title)}</div></div>`,
        width: 150,
        height: 42,
        anchorX: 75,
        anchorY: 7,
      };
    case "draft":
      return { html: '<div class="st-draft"></div>', width: 22, height: 22, anchorX: 11, anchorY: 11 };
    default: {
      const color = marker.kind === "sos" ? "#B42318" : marker.kind === "end" ? "#15803D" : marker.tint ?? "#245E9C";
      return {
        html: `<div class="st-pin"><div class="st-pin-head" style="background:${esc(color)}"></div><div class="st-pin-dot"></div></div>`,
        width: 30,
        height: 40,
        anchorX: 15,
        anchorY: 36,
      };
    }
  }
}

export const MARKER_CSS = `
.st-av{position:relative;width:64px;height:100%;display:flex;flex-direction:column;align-items:center;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.st-av-ring{position:relative;margin-top:6px;width:50px;height:50px;box-sizing:border-box;border-radius:50%;border:3px solid var(--ring);padding:2px;background:#fff;box-shadow:0 3px 10px rgba(16,40,30,.28)}
.st-av-photo,.st-av-initials{position:absolute;left:2px;top:2px;width:40px;height:40px;border-radius:50%}
.st-av-photo{object-fit:cover;z-index:1}
.st-av-initials{display:flex;align-items:center;justify-content:center;color:#fff;font:800 14px/1 inherit}
.st-av-pointer{width:0;height:0;margin-top:-1px;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid var(--ring)}
.st-av-source{position:absolute;top:2px;right:4px;width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid #E3E9E5;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.st-av-source svg{width:11px;height:11px;fill:#0E1411}
.st-av-battery{position:absolute;top:40px;right:0;padding:0 4px;height:16px;border-radius:8px;background:#fff;border:1px solid #E3E9E5;font:800 9px/14px inherit;color:#0E1411;box-sizing:border-box}
.st-av-mode{position:absolute;top:38px;left:2px;width:22px;height:22px;box-sizing:border-box;border-radius:50%;background:#15803D;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.st-av-mode svg{width:14px;height:14px;fill:none;stroke:#fff;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.st-av-mode svg circle{fill:none}
.st-av-battery.low{background:#FDECEA;border-color:#F6C9C3;color:#B42318}
.st-av-label{margin-top:2px;padding:0 7px;height:18px;border-radius:9px;background:#245E9C;color:#fff;font:800 10px/18px inherit}
.st-av.replay .st-av-ring{opacity:.92}
.st-av-halo{position:absolute;top:3px;left:6px;width:52px;height:52px;box-sizing:border-box;border-radius:50%;border:4px solid var(--ring);animation:st-pulse 1.4s ease-out infinite}
@keyframes st-pulse{from{transform:scale(1);opacity:.7}to{transform:scale(1.45);opacity:0}}
.st-start{margin:2px;width:18px;height:18px;box-sizing:border-box;border-radius:50%;border:4px solid #15803D;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.st-stop{margin:1px;width:26px;height:26px;box-sizing:border-box;border-radius:50%;background:#0D2A1E;border:2px solid #fff;color:#fff;display:flex;align-items:center;justify-content:center;font:800 11px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}
.st-event{margin:1px;width:28px;height:28px;box-sizing:border-box;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.25);cursor:pointer}
.st-event svg{width:15px;height:15px;fill:#fff}
.st-zone{width:150px;height:42px;display:flex;flex-direction:column;align-items:center;cursor:pointer}
.st-zone-dot{width:14px;height:14px;box-sizing:border-box;border-radius:50%;border:3px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.st-zone-chip{margin-top:3px;max-width:146px;padding:0 8px;height:22px;box-sizing:border-box;border-radius:11px;background:rgba(255,255,255,.95);border:1px solid #E3E9E5;color:#0E1411;font:700 11px/20px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.st-draft{margin:1px;width:20px;height:20px;box-sizing:border-box;border-radius:50%;background:rgba(30,79,216,.18);border:2px solid #245E9C;display:flex;align-items:center;justify-content:center}
.st-draft:after{content:"";width:6px;height:6px;border-radius:50%;background:#245E9C}
.st-pin{position:relative;width:30px;height:40px;cursor:pointer}
.st-pin-head{position:absolute;left:2px;top:2px;width:26px;height:26px;box-sizing:border-box;border-radius:50% 50% 0 50%;transform:rotate(45deg);border:2px solid #fff;box-shadow:0 2px 8px rgba(16,40,30,.3)}
.st-pin-dot{position:absolute;left:11px;top:11px;width:8px;height:8px;border-radius:50%;background:#fff}
.st-person{position:relative;width:92px;height:100%;cursor:pointer;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.st-person .st-av-ring{position:absolute;left:21px;top:21px;margin:0}
.st-person .st-av-halo{top:20px;left:20px}
.st-person .st-av-source{top:17px;right:15px}
.st-person .st-av-mode{top:53px;left:15px}
.st-person .st-av-battery{top:55px;right:9px}
.st-person .st-av-label{position:absolute;top:90px;left:50%;transform:translateX(-50%);white-space:nowrap;margin:0}
.st-av-label.me{background:#1A73E8}
.st-dir{position:absolute;left:0;top:0;width:92px;height:92px;pointer-events:none;transition:transform .32s cubic-bezier(.2,.8,.2,1),opacity .26s}
.st-dir.off{opacity:0}
.st-dir-cone{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from -34deg,var(--tint) 0deg 68deg,transparent 68deg);-webkit-mask:radial-gradient(circle,rgba(0,0,0,.85) 25%,rgba(0,0,0,.35) 55%,transparent 72%);mask:radial-gradient(circle,rgba(0,0,0,.85) 25%,rgba(0,0,0,.35) 55%,transparent 72%);animation:st-breathe 2.8s ease-in-out infinite}
.st-dir-arrow{position:absolute;inset:0;width:92px;height:92px;overflow:visible;z-index:5;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.35))}
.st-dir-arrow path{fill:var(--tint);stroke:#fff;stroke-width:2.2;stroke-linejoin:round}
@keyframes st-breathe{0%,100%{opacity:.6}50%{opacity:1}}
.st-foot{width:22px;height:22px;transform:rotate(calc(var(--hd) * 1deg - var(--map-bearing,0deg)))}
.st-foot.r svg{transform:scaleX(-1)}
.st-foot svg{width:100%;height:100%;display:block;overflow:visible}
.st-foot .st-foot-shape{fill:#0D2A1E;stroke:#fff;stroke-width:1.1;paint-order:stroke;filter:drop-shadow(0 .6px .6px rgba(0,0,0,.3))}
.st-foot.run .st-foot-shape{fill:#15803D}
.st-foot .st-foot-tread{fill:#fff}
body.dark .st-foot .st-foot-shape{fill:#CDEFD9;stroke:#0D2A1E}
body.dark .st-foot.run .st-foot-shape{fill:#3DDC84}
body.dark .st-foot .st-foot-tread{fill:#0D2A1E}
.st-foot.fresh svg{animation:st-press .42s cubic-bezier(.2,.8,.2,1) both}
.st-foot.r.fresh svg{animation-name:st-press-r}
@keyframes st-press{from{transform:scale(1.45);opacity:.35}to{transform:scale(1);opacity:1}}
@keyframes st-press-r{from{transform:scaleX(-1) scale(1.45);opacity:.35}to{transform:scaleX(-1) scale(1);opacity:1}}
`;
