/**
 * Inline SVG icons (DESIGN-M6-001 §5, ADR-0015 point 5). Paths copied from Lucide release 1.64.0 (lucide-static,
 * https://lucide.dev), ISC licence; icons derived from Feather (calendar, plus, search, x, chevron-left/right, info,
 * check, sun, moon, monitor, smartphone, trash-2, upload) are also © Cole Bemis under the MIT licence. Full texts in
 * apps/web/public/licenses.txt. Lucide names: calendar, plus, layers, search, x, chevron-left, chevron-right, info,
 * triangle-alert, check, sun, moon, monitor, smartphone, image, file-text, printer, palette, trash-2, upload, wifi-off.
 *
 * Each icon is its own export so only the icons in use reach the bundle; no icon package, font or sprite. Icons are
 * decorative by default (aria-hidden, focusable=false) and draw in currentColor with a 2 px stroke; pass `label` only
 * when the icon itself carries meaning.
 */
import type { ReactNode } from "react";

export type IconProps = { size?: number; className?: string; label?: string };

function Svg(props: IconProps & { children: ReactNode }) {
  const size = props.size ?? 20;
  const a11y = props.label ? { role: "img", "aria-label": props.label } : { "aria-hidden": true as const };
  return (
    <svg
      className={props.className ? `icon ${props.className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...a11y}
    >
      {props.children}
    </svg>
  );
}

export function IconCalendar(props: IconProps) {
  return <Svg {...props}><path d="M8 2v3" /><path d="M16 2v3" /><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /></Svg>;
}

export function IconPlus(props: IconProps) {
  return <Svg {...props}><path d="M5 12h14" /><path d="M12 5v14" /></Svg>;
}

/** "Phương án" (plans). */
export function IconLayers(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" />
      <path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" />
      <path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" />
    </Svg>
  );
}

export function IconSearch(props: IconProps) {
  return <Svg {...props}><path d="m21 21-4.34-4.34" /><circle cx="11" cy="11" r="8" /></Svg>;
}

export function IconClose(props: IconProps) {
  return <Svg {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Svg>;
}

export function IconChevronLeft(props: IconProps) {
  return <Svg {...props}><path d="m15 18-6-6 6-6" /></Svg>;
}

export function IconChevronRight(props: IconProps) {
  return <Svg {...props}><path d="m9 18 6-6-6-6" /></Svg>;
}

export function IconInfo(props: IconProps) {
  return <Svg {...props}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></Svg>;
}

export function IconWarning(props: IconProps) {
  return <Svg {...props}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></Svg>;
}

export function IconCheck(props: IconProps) {
  return <Svg {...props}><path d="M20 6 9 17l-5-5" /></Svg>;
}

export function IconSun(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </Svg>
  );
}

export function IconMoon(props: IconProps) {
  return <Svg {...props}><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" /></Svg>;
}

export function IconMonitor(props: IconProps) {
  return <Svg {...props}><rect width="20" height="14" x="2" y="3" rx="2" /><line x1="8" x2="16" y1="21" y2="21" /><line x1="12" x2="12" y1="17" y2="21" /></Svg>;
}

export function IconSmartphone(props: IconProps) {
  return <Svg {...props}><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></Svg>;
}

export function IconImage(props: IconProps) {
  return <Svg {...props}><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></Svg>;
}

export function IconFile(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </Svg>
  );
}

export function IconPrinter(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" />
      <rect x="6" y="14" width="12" height="8" rx="1" />
    </Svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    </Svg>
  );
}

export function IconTrash(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Svg>
  );
}

export function IconUpload(props: IconProps) {
  return <Svg {...props}><path d="M12 3v12" /><path d="m17 8-5-5-5 5" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /></Svg>;
}

export function IconOffline(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20h.01" />
      <path d="M8.5 16.429a5 5 0 0 1 7 0" />
      <path d="M5 12.859a10 10 0 0 1 5.17-2.69" />
      <path d="M19 12.859a10 10 0 0 0-2.007-1.523" />
      <path d="M2 8.82a15 15 0 0 1 4.177-2.643" />
      <path d="M22 8.82a15 15 0 0 0-11.288-3.764" />
      <path d="m2 2 20 20" />
    </Svg>
  );
}
