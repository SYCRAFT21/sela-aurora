import React, { useEffect, useMemo, useRef, useState } from "react";
import "./AuroraFullyInteractiveEmailClient.css";
import { AVATARS, PHOTO } from "./auroraImages";
type IconName = "mail" | "inbox" | "star" | "send" | "file" | "archive" | "trash" | "shield" | "clock" | "calendar" | "search" | "settings" | "plus" | "menu" | "chevronDown" | "chevronLeft" | "chevronRight" | "reply" | "replyAll" | "forward" | "paperclip" | "image" | "bell" | "refresh" | "more" | "x" | "check" | "checkCircle" | "alert" | "info" | "filter" | "sliders" | "grid" | "list" | "users" | "user" | "lock" | "palette" | "keyboard" | "sun" | "moon" | "download" | "upload" | "external" | "printer" | "flag" | "tag" | "edit" | "link" | "bold" | "italic" | "underline" | "at" | "eye" | "eyeOff" | "folder" | "folderPlus" | "help" | "arrowUp" | "arrowDown" | "arrowRight" | "layers" | "sparkles" | "wifiOff" | "circle" | "maximize" | "minimize" | "copy" | "paperPlane" | "undo" | "cloud";
const PATHS: Record<IconName, React.ReactNode> = {
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" data-magicpath-id="0" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m3 7 9 6 9-6" data-magicpath-id="1" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  inbox: <><rect x="3" y="4" width="18" height="16" rx="2" data-magicpath-id="2" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M3 13h5l2 3h4l2-3h5" data-magicpath-id="3" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  star: <path d="m12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-5 7-.9L12 2Z" data-magicpath-id="4" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  send: <><path d="M22 2 11 13" data-magicpath-id="5" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m22 2-7 20-4-9-9-4 20-7Z" data-magicpath-id="6" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  file: <><path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" data-magicpath-id="7" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M14 3v6h5M9 13h6M9 17h6" data-magicpath-id="8" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  archive: <><rect x="3" y="4" width="18" height="5" rx="1" data-magicpath-id="9" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M5 9v11h14V9m-9 4h4" data-magicpath-id="10" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  trash: <><path d="M3 6h18m-14 0 1 15h8l1-15M9 6V4h6v2m-5 4v7m4-7v7" data-magicpath-id="11" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  shield: <><path d="M12 2 4 5v6c0 6 4.4 9 8 11 3.6-2 8-5 8-11V5l-8-3Z" data-magicpath-id="12" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m9 12 2 2 4-4" data-magicpath-id="13" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  clock: <><circle cx="12" cy="12" r="9" data-magicpath-id="14" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M12 7v5l4 2" data-magicpath-id="15" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" data-magicpath-id="16" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M7 3v4m10-4v4M3 10h18m-13 4h2m4 0h2" data-magicpath-id="17" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  search: <><circle cx="11" cy="11" r="7" data-magicpath-id="18" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m16 16 5 5" data-magicpath-id="19" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  settings: <><circle cx="12" cy="12" r="3" data-magicpath-id="20" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m19 13 2 1-2 4-2-1-2 1v2H9v-2l-2-1-2 1-2-4 2-1v-2l-2-1 2-4 2 1 2-1V4h6v2l2 1 2-1 2 4-2 1Z" data-magicpath-id="21" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  plus: <path d="M12 5v14M5 12h14" data-magicpath-id="22" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" data-magicpath-id="23" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  chevronDown: <path d="m6 9 6 6 6-6" data-magicpath-id="24" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  chevronLeft: <path d="m15 18-6-6 6-6" data-magicpath-id="25" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  chevronRight: <path d="m9 18 6-6-6-6" data-magicpath-id="26" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  reply: <path d="m10 9-6 5 6 5v-4h5c4 0 6 2 6 5 0-7-2-11-10-11h-1V9Z" data-magicpath-id="27" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  replyAll: <><path d="m10 8-5 5 5 5M14 8l-5 5 5 5" data-magicpath-id="28" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M13 13h4c3 0 4 2 4 5" data-magicpath-id="29" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  forward: <path d="m14 9 6 5-6 5v-4H9c-4 0-6 2-6 5 0-7 2-11 10-11h1V9Z" data-magicpath-id="30" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  paperclip: <path d="M19 12.5 11 20a6 6 0 0 1-8-8L12 3a4 4 0 0 1 6 6l-9 9a2 2 0 0 1-3-3l8-8" data-magicpath-id="31" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" data-magicpath-id="32" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="8.5" cy="9" r="1.5" data-magicpath-id="33" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m3 17 6-6 4 4 3-3 5 5" data-magicpath-id="34" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Zm4 11h4" data-magicpath-id="35" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  refresh: <><path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" data-magicpath-id="36" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  more: <><circle cx="5" cy="12" r="1" data-magicpath-id="37" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="12" cy="12" r="1" data-magicpath-id="38" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="19" cy="12" r="1" data-magicpath-id="39" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  x: <path d="M5 5 19 19M19 5 5 19" data-magicpath-id="40" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  check: <path d="m4 12 5 5L20 6" data-magicpath-id="41" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  checkCircle: <><circle cx="12" cy="12" r="9" data-magicpath-id="42" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m7 12 3 3 7-7" data-magicpath-id="43" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  alert: <><path d="m12 3 10 18H2L12 3Z" data-magicpath-id="44" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M12 9v5m0 3v1" data-magicpath-id="45" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  info: <><circle cx="12" cy="12" r="9" data-magicpath-id="46" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M12 11v5m0-9v1" data-magicpath-id="47" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  filter: <><path d="M3 4h18l-7 8v7l-4 2v-9L3 4Z" data-magicpath-id="48" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  sliders: <><path d="M4 7h16M4 17h16" data-magicpath-id="49" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="9" cy="7" r="2" fill="currentColor" stroke="none" data-magicpath-id="50" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="16" cy="17" r="2" fill="currentColor" stroke="none" data-magicpath-id="51" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" data-magicpath-id="52" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><rect x="14" y="3" width="7" height="7" rx="1" data-magicpath-id="53" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><rect x="3" y="14" width="7" height="7" rx="1" data-magicpath-id="54" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><rect x="14" y="14" width="7" height="7" rx="1" data-magicpath-id="55" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  list: <path d="M8 5h13M8 12h13M8 19h13M3 5h1M3 12h1M3 19h1" data-magicpath-id="56" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  users: <><circle cx="9" cy="8" r="3" data-magicpath-id="57" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M2 20v-2a7 7 0 0 1 14 0v2H2ZM17 5a3 3 0 0 1 0 6m0 3c3 0 5 2 5 5" data-magicpath-id="58" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  user: <><circle cx="12" cy="8" r="4" data-magicpath-id="59" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" data-magicpath-id="60" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" data-magicpath-id="61" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M8 10V7a4 4 0 1 1 8 0v3" data-magicpath-id="62" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  palette: <><circle cx="12" cy="12" r="10" data-magicpath-id="63" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="7" cy="12" r="1" data-magicpath-id="64" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="10" cy="7" r="1" data-magicpath-id="65" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="16" cy="8" r="1" data-magicpath-id="66" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M17 15c-3-1-5 1-4 3s1 4-1 4" data-magicpath-id="67" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="2" data-magicpath-id="68" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M6 9h1m3 0h1m3 0h1m3 0h1M6 13h1m3 0h1m3 0h1m3 0h1M8 16h8" data-magicpath-id="69" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  sun: <><circle cx="12" cy="12" r="4" data-magicpath-id="70" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M12 2v2m0 16v2M4 4l2 2m12 12 2 2M2 12h2m16 0h2M4 20l2-2M18 6l2-2" data-magicpath-id="71" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  moon: <path d="M19 15A8 8 0 0 1 9 5 8 8 0 1 0 19 15Z" data-magicpath-id="72" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" data-magicpath-id="73" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  upload: <><path d="M12 17V4m-5 5 5-5 5 5M4 17v4h16v-4" data-magicpath-id="74" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  external: <><path d="M13 4h7v7m0-7-9 9" data-magicpath-id="75" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M20 14v6H4V4h6" data-magicpath-id="76" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  printer: <><path d="M6 9V3h12v6m-12 8H3v-7h18v7h-3" data-magicpath-id="77" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M6 15h12v7H6v-7Z" data-magicpath-id="78" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  flag: <path d="M5 22V4m0 1c6-4 8 3 15-1v12c-7 4-9-3-15 1" data-magicpath-id="79" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  tag: <><path d="M3 4h10l8 8-9 9-9-9V4Z" data-magicpath-id="80" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="8" cy="9" r="1" data-magicpath-id="81" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  edit: <><path d="M4 20h5l11-11-5-5L4 15v5Zm9-14 5 5" data-magicpath-id="82" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  link: <><path d="M9 15h6m-7-9H6a5 5 0 0 0 0 10h3m6-10h3a5 5 0 0 1 0 10h-3" data-magicpath-id="83" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  bold: <path d="M6 4h7a4 4 0 0 1 0 8H6V4Zm0 8h8a4 4 0 0 1 0 8H6v-8Z" data-magicpath-id="84" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  italic: <path d="M14 3 9 21m-1-18h10M6 21h10" data-magicpath-id="85" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  underline: <path d="M6 3v8a6 6 0 0 0 12 0V3M4 21h16" data-magicpath-id="86" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  at: <><circle cx="12" cy="12" r="9" data-magicpath-id="87" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M16 8v7c0 3 4 3 4-2a8 8 0 1 0-4 7" data-magicpath-id="88" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="12" cy="12" r="4" data-magicpath-id="89" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" data-magicpath-id="90" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><circle cx="12" cy="12" r="3" data-magicpath-id="91" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  eyeOff: <><path d="M3 3 21 21M9 6.5A11 11 0 0 1 12 5c6 0 10 7 10 7a16 16 0 0 1-4 4.5M6 8C3.5 10 2 12 2 12s4 7 10 7c1.5 0 2.9-.4 4.1-1M10 10a3 3 0 0 0 4 4" data-magicpath-id="92" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  folder: <path d="M3 6h7l2 3h9v11H3V6Z" data-magicpath-id="93" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  folderPlus: <><path d="M3 6h7l2 3h9v11H3V6Z" data-magicpath-id="94" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M12 11v7m-3.5-3.5h7" data-magicpath-id="95" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  help: <><circle cx="12" cy="12" r="9" data-magicpath-id="96" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M9 9a3 3 0 1 1 6 1c-1 2-3 2-3 5m0 3v1" data-magicpath-id="97" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  arrowUp: <path d="m12 3-6 6m6-6 6 6M12 3v18" data-magicpath-id="98" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  arrowDown: <path d="m12 21-6-6m6 6 6-6M12 21V3" data-magicpath-id="99" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  arrowRight: <path d="M3 12h18m-7-7 7 7-7 7" data-magicpath-id="100" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  layers: <><path d="m12 3 10 6-10 6L2 9l10-6Zm-10 11 10 6 10-6" data-magicpath-id="101" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  sparkles: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" data-magicpath-id="102" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  wifiOff: <path d="m2 2 20 20M4 10a13 13 0 0 1 15-1M8 14a7 7 0 0 1 7-.5M12 19h.01" data-magicpath-id="103" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  circle: <circle cx="12" cy="12" r="8" data-magicpath-id="104" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  maximize: <path d="M8 3H3v5m0-5 6 6m7-6h5v5m0-5-6 6M3 16v5h5m-5 0 6-6m12 1v5h-5m5 0-6-6" data-magicpath-id="105" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  minimize: <path d="M8 3v5H3m5 0-6-6m14 1v5h5m-5 0 6-6M8 21v-5H3m5 0-6 6m8-6h5v5m-5-5 6 6" data-magicpath-id="106" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" data-magicpath-id="107" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="M16 8V4H4v12h4" data-magicpath-id="108" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  paperPlane: <><path d="m2 12 19-9-6 18-4-7-9-2Z" data-magicpath-id="109" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><path d="m11 14 10-11" data-magicpath-id="110" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>,
  undo: <path d="M8 7 3 12l5 5M3 12h11a6 6 0 0 1 6 6" data-magicpath-id="111" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />,
  cloud: <path d="M6 18a5 5 0 0 1 0-10h2a5 5 0 0 1 9 1h1a4 4 0 0 1 0 9H6Z" data-magicpath-id="112" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />
};
function I({
  n,
  size = 18,
  fill = false,
  className = ""
}: {
  n: IconName;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-magicpath-id="113" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{PATHS[n]}</svg>;
}
type Account = {
  id: string;
  name: string;
  email: string;
  provider: "Gmail" | "Outlook";
  color: string;
  initials: string;
  online: boolean;
  unread: number;
};
type Mail = {
  id: number;
  from: string;
  address: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  time: string;
  accountId: string;
  category: string;
  folder: string;
  unread: boolean;
  starred: boolean;
  important: boolean;
  attachments: string[];
  labels: string[];
  avatar: string;
  thread: number;
  newsletter?: boolean;
  photo?: string;
};
type Modal = "none" | "addAccount" | "connectStep" | "accountSuccess" | "disconnect" | "schedule" | "snooze" | "move" | "labels" | "newLabel" | "permanent" | "emptyTrash" | "attachments" | "sender" | "shortcuts" | "createRule" | "print" | "reconnect" | "offline" | "help";
type View = "mail" | "accounts" | "settings" | "contacts" | "stateGallery" | "rules" | "notifications" | "calendar" | "labels";
type ComposeMode = "new" | "reply" | "replyAll" | "forward" | "draft";
const ACCOUNTS: Account[] = [{
  id: "personal",
  name: "Personal",
  email: "alex.ramadhan@gmail.com",
  provider: "Gmail",
  color: "#c5a8ff",
  initials: "A",
  online: true,
  unread: 12
}, {
  id: "studio",
  name: "Aurora Studio",
  email: "team.aurora@gmail.com",
  provider: "Gmail",
  color: "#7ad7ba",
  initials: "S",
  online: true,
  unread: 8
}, {
  id: "work",
  name: "Work",
  email: "alex@outlook.com",
  provider: "Outlook",
  color: "#75b8ff",
  initials: "W",
  online: true,
  unread: 4
}];
const PEOPLE = ["Alya Rahman", "Dimas Saputra", "Nadia Putri", "Raka Pratama", "Sarah Putri", "Bima Aditya", "Luna Wijaya", "Fajar Nugroho", "Kevin Hartono", "Maya Lestari", "Adrian Putra", "Dina Amelia"];
const SUBJECTS = [["Review terakhir sebelum handoff", "Halo Alex, boleh kita review file final dan desain hari Jumat? Aku sudah menambahkan catatan pada komponen utama.", "Utama"], ["Your November design digest ✦", "A fresh selection of ideas, products and thoughtful spaces, curated just for you.", "Promosi"], ["Undangan: Weekly Product Sync", "Hai tim, meeting product sync pindah ke Jumat pukul 14.00. Jangan lupa update task di board.", "Utama"], ["New sign-in to your account", "We noticed a sign-in from a new device. Review this activity if it wasn't you.", "Update"], ["Invoice #AU-1048 — November", "Your invoice is ready. Please review the PDF attachment and payment details.", "Update"], ["Re: Konsep identitas Aurora", "Terima kasih! Warna lavender dan aksen teal sudah cocok. Bisa kita lanjut ke prototipe?", "Utama"], ["A better way to create", "Explore this month's inspiring stories, thoughtful interiors and creative workflows.", "Promosi"], ["Project board update", "The sprint board has 4 new comments and 2 tasks ready for your review.", "Sosial"], ["Foto dari perjalanan kemarin", "Aku kirim beberapa foto favorit buat dimasukkan ke galeri desain, ya!", "Utama"], ["Your weekly developer report", "Your latest deployments, security alerts, and system health at a glance.", "Update"], ["Terima kasih sudah mendaftar!", "Selamat bergabung. Ini detail acara dan langkah selanjutnya untuk kamu.", "Sosial"], ["Proposal kerja sama Q4", "Halo Alex, berikut rangkuman proposal dan timeline kerja sama yang kita diskusikan.", "Utama"]];
function makeMails(): Mail[] {
  return Array.from({
    length: 32
  }, (_, i) => {
    const subject = SUBJECTS[i % SUBJECTS.length],
      person = PEOPLE[i % PEOPLE.length];
    const orgs = ["Linear", "Notion", "DigitalOcean", "Google Security", "Unsplash", "Figma", "GitHub", "Canva"];
    const from = i % 5 === 1 ? orgs[(i / 5 | 0) % orgs.length] : person;
    const accountId = i % 3 === 0 ? "personal" : i % 3 === 1 ? "studio" : "work";
    const folder = i === 13 ? "drafts" : i === 15 ? "sent" : i === 18 ? "archive" : i === 21 ? "spam" : i === 23 ? "trash" : i === 26 ? "scheduled" : i === 29 ? "snoozed" : "inbox";
    const attachment = i % 4 === 0 ? ["Aurora-moodboard.png", "Layout-final.pdf"] : i % 7 === 0 ? ["Proposal-2026.pdf"] : [];
    return {
      id: i + 1,
      from,
      address: from.toLowerCase().replace(/ /g, ".") + "@example.com",
      subject: subject[0],
      snippet: subject[1],
      body: `Halo Alex,\n\n${subject[1]}\n\nKita sudah menyiapkan detail yang dibutuhkan untuk langkah berikutnya. Silakan cek catatan, berikan masukan, dan beri tahu jika ada sesuatu yang perlu direvisi.\n\nKalau ada pertanyaan, langsung balas email ini saja.\n\nTerima kasih,\n${from}`,
      date: i < 8 ? "Hari ini" : i < 15 ? "Kemarin" : `${Math.max(1, 5 - Math.floor(i / 6))} Nov`,
      time: ["10:42", "10:18", "09:37", "08:51", "08:24", "07:45", "07:12", "06:50"][i % 8],
      accountId,
      category: subject[2],
      folder,
      unread: i < 11 && i % 3 !== 2,
      starred: i === 2 || i === 5 || i === 16,
      important: i === 0 || i === 8 || i === 13,
      attachments: attachment,
      labels: i % 5 === 0 ? ["Project Aurora"] : i % 6 === 0 ? ["Keuangan"] : [],
      avatar: String(i % 12 + 1),
      thread: i % 6 === 0 ? 3 : 1,
      newsletter: i % 5 === 1 || i % 5 === 4,
      photo: i % 5 === 1 ? PHOTO.interior : i % 5 === 4 ? PHOTO.travel : undefined
    };
  });
}
const FOLDERS: {
  id: string;
  label: string;
  icon: IconName;
  section?: boolean;
}[] = [{
  id: "inbox",
  label: "Semua inbox",
  icon: "inbox"
}, {
  id: "starred",
  label: "Berbintang",
  icon: "star"
}, {
  id: "important",
  label: "Penting",
  icon: "flag"
}, {
  id: "snoozed",
  label: "Ditunda",
  icon: "clock"
}, {
  id: "scheduled",
  label: "Terjadwal",
  icon: "calendar"
}, {
  id: "sent",
  label: "Terkirim",
  icon: "send"
}, {
  id: "drafts",
  label: "Draf",
  icon: "file"
}, {
  id: "archive",
  label: "Arsip",
  icon: "archive"
}, {
  id: "spam",
  label: "Spam",
  icon: "shield"
}, {
  id: "trash",
  label: "Sampah",
  icon: "trash"
}, {
  id: "all",
  label: "Semua email",
  icon: "mail"
}];
const CATEGORY = ["Semua", "Utama", "Promosi", "Sosial", "Update"];
function Btn({
  icon,
  label,
  onClick,
  variant = "ghost",
  title,
  disabled = false,
  active = false,
  className = "",
  size = "normal"
}: {
  icon?: IconName;
  label?: string;
  onClick?: () => void;
  variant?: "ghost" | "secondary" | "primary" | "danger" | "mint";
  title?: string;
  disabled?: boolean;
  active?: boolean;
  className?: string;
  size?: "normal" | "small";
}) {
  return <button type="button" disabled={disabled} onClick={onClick} title={title || label} aria-label={title || label} className={`au-btn au-btn-${variant} ${size === "small" ? "au-btn-sm" : ""} ${active ? "au-btn-active" : ""} ${className}`} data-magicpath-id="114" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{icon && <I n={icon} size={size === "small" ? 15 : 17} data-magicpath-id="115" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />} {label && <span data-magicpath-id="116" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{label}</span>}</button>;
}
function Avatar({
  name,
  seed,
  color,
  size = 40
}: {
  name: string;
  seed?: string;
  color?: string;
  size?: number;
}) {
  const initials = name.split(" ").map(x => x[0]).slice(0, 2).join("");
  const idx = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATARS.length;
  return <div className="au-avatar" style={{
    width: size,
    height: size,
    background: color ? `${color}28` : undefined,
    color: color || undefined,
    flexShrink: 0
  }} data-magicpath-id="117" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><img src={AVATARS[idx]} alt="" aria-hidden="true" data-magicpath-id="118" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{!AVATARS[idx] && initials}</div>;
}
const formatDate = (d: Date) => d.toISOString().slice(0, 10);
export const AuroraFullyInteractiveEmailClient = () => {
  const [accounts, setAccounts] = useState<Account[]>(ACCOUNTS);
  const [mails, setMails] = useState<Mail[]>(makeMails);
  const [view, setView] = useState<View>("mail");
  const [folder, setFolder] = useState("inbox");
  const [account, setAccount] = useState("all");
  const [category, setCategory] = useState("Semua");
  const [selectedMail, setSelectedMail] = useState<number | null>(1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [modal, setModal] = useState<Modal>("none");
  const [showSearchFilter, setShowSearchFilter] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterDate, setFilterDate] = useState("any");
  const [filterAccount, setFilterAccount] = useState("all");
  const [filterAttachment, setFilterAttachment] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [sort, setSort] = useState("newest");
  const [compose, setCompose] = useState(false);
  const [composeFull, setComposeFull] = useState(false);
  const [composeMode, setComposeMode] = useState<ComposeMode>("new");
  const [sendFrom, setSendFrom] = useState("personal");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [formatting, setFormatting] = useState<string[]>([]);
  const [signature, setSignature] = useState(true);
  const [dateVal, setDateVal] = useState(formatDate(new Date()));
  const [timeVal, setTimeVal] = useState("09:00");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: string;
    undo?: () => void;
  } | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileReading, setMobileReading] = useState(false);
  const [settingTab, setSettingTab] = useState("Umum");
  const [density, setDensity] = useState("comfortable");
  const [theme, setTheme] = useState("Aurora Dark");
  const [previewPane, setPreviewPane] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [sound, setSound] = useState(false);
  const [autorefresh, setAutorefresh] = useState(true);
  const [sigText, setSigText] = useState("Salam hangat,\nAlex Ramadhan\nSela Aurora");
  const [labelList, setLabelList] = useState(["Project Aurora", "Keuangan", "Personal", "Penting Q4"]);
  const [newLabel, setNewLabel] = useState("");
  const [editLabel, setEditLabel] = useState<string | null>(null);
  const [selectedAcc, setSelectedAcc] = useState("personal");
  const [provider, setProvider] = useState<"Gmail" | "Outlook">("Gmail");
  const [oauthEmail, setOauthEmail] = useState("");
  const [oauthStage, setOauthStage] = useState(1);
  const [stateDemo, setStateDemo] = useState("normal");
  const [rules, setRules] = useState([{
    id: 1,
    label: "Invoice otomatis → Keuangan",
    enabled: true
  }, {
    id: 2,
    label: "Newsletter → Promosi",
    enabled: true
  }]);
  const [ruleFrom, setRuleFrom] = useState("");
  const [ruleAction, setRuleAction] = useState("label");
  const [activeImage, setActiveImage] = useState(0);
  const [expandedThread, setExpandedThread] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(3);
  const [syncState, setSyncState] = useState("Terhubung");
  const [showAccMenu, setShowAccMenu] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const selected = mails.find(m => m.id === selectedMail) || null;
  const selectedAccount = accounts.find(a => a.id === account);
  const toastNow = (message: string, type = "success", undo?: () => void) => setToast({
    message,
    type,
    undo
  });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4400);
    return () => clearTimeout(t);
  }, [toast]);
  const shownMails = useMemo(() => {
    let arr = mails.filter(m => account === "all" || m.accountId === account);
    if (folder === "starred") arr = arr.filter(m => m.starred);else if (folder === "important") arr = arr.filter(m => m.important);else if (folder === "all") arr = arr.filter(m => !["trash", "spam"].includes(m.folder));else if (folder.startsWith("label:")) arr = arr.filter(m => m.labels.includes(folder.slice(6)));else arr = arr.filter(m => m.folder === folder);
    if ((folder === "inbox" || folder === "all") && category !== "Semua") arr = arr.filter(m => m.category === category);
    if (query.trim()) {
      const q = query.toLowerCase();
      arr = arr.filter(m => (m.from + " " + m.subject + " " + m.snippet + " " + m.address).toLowerCase().includes(q));
    }
    if (filterFrom) arr = arr.filter(m => m.address.toLowerCase().includes(filterFrom.toLowerCase()) || m.from.toLowerCase().includes(filterFrom.toLowerCase()));
    if (filterAccount !== "all") arr = arr.filter(m => m.accountId === filterAccount);
    if (filterAttachment) arr = arr.filter(m => m.attachments.length > 0);
    if (onlyUnread) arr = arr.filter(m => m.unread);
    if (filterDate === "today") arr = arr.filter(m => m.date === "Hari ini");
    if (filterDate === "week") arr = arr.filter(m => m.date === "Hari ini" || m.date === "Kemarin");
    if (sort === "oldest") arr = [...arr].reverse();
    if (sort === "sender") arr = [...arr].sort((a, b) => a.from.localeCompare(b.from));
    return arr;
  }, [mails, account, folder, category, query, filterFrom, filterDate, filterAccount, filterAttachment, onlyUnread, sort]);
  const unreadCount = mails.filter(m => m.folder === "inbox" && m.unread).length;
  function nav(id: string, acc?: string) {
    setView("mail");
    setFolder(id);
    setCategory("Semua");
    setQuery("");
    setSearch("");
    setSelectedMail(null);
    setSelectedIds([]);
    setMobileReading(false);
    setMenu(null);
    setSidebarOpen(false);
    if (acc !== undefined) setAccount(acc);
  }
  function navView(v: View) {
    setView(v);
    setMenu(null);
    setSidebarOpen(false);
    setMobileReading(false);
    setShowAccMenu(false);
  }
  function openMail(id: number) {
    setSelectedMail(id);
    setMobileReading(true);
    setExpandedThread(false);
    setShowDetails(false);
    setMails(prev => prev.map(m => m.id === id ? {
      ...m,
      unread: false
    } : m));
    setSelectedIds([]);
  }
  function updateMail(ids: number[], patch: Partial<Mail>, notice?: string) {
    const before = mails.map(m => ({
      ...m,
      labels: [...m.labels]
    }));
    setMails(curr => curr.map(m => ids.includes(m.id) ? {
      ...m,
      ...patch
    } : m));
    if (notice) toastNow(notice, "success", () => {
      setMails(before);
      toastNow("Perubahan dibatalkan");
    });
    setSelectedIds([]);
  }
  function handleAction(action: string, id?: number) {
    const ids = id ? [id] : selectedIds.length ? selectedIds : selectedMail ? [selectedMail] : [];
    if (!ids.length) {
      toastNow("Pilih email terlebih dahulu", "warning");
      return;
    }
    const ref = mails.find(m => m.id === ids[0]);
    switch (action) {
      case "star":
        updateMail(ids, {
          starred: !ref?.starred
        }, ref?.starred ? "Bintang dihapus" : "Ditandai berbintang");
        break;
      case "unread":
        updateMail(ids, {
          unread: true
        }, "Ditandai belum dibaca");
        break;
      case "read":
        updateMail(ids, {
          unread: false
        }, "Ditandai sudah dibaca");
        break;
      case "important":
        updateMail(ids, {
          important: !ref?.important
        }, "Status penting diperbarui");
        break;
      case "archive":
        updateMail(ids, {
          folder: "archive"
        }, "Email diarsipkan");
        setSelectedMail(null);
        setMobileReading(false);
        break;
      case "trash":
        updateMail(ids, {
          folder: "trash"
        }, "Email dipindahkan ke Sampah");
        setSelectedMail(null);
        setMobileReading(false);
        break;
      case "spam":
        updateMail(ids, {
          folder: "spam"
        }, "Email dipindahkan ke Spam");
        setSelectedMail(null);
        setMobileReading(false);
        break;
      case "notSpam":
        updateMail(ids, {
          folder: "inbox"
        }, "Email bukan spam — dikembalikan ke Inbox");
        setSelectedMail(null);
        break;
      case "restore":
        updateMail(ids, {
          folder: "inbox"
        }, "Email berhasil dipulihkan");
        setSelectedMail(null);
        break;
      case "snooze":
        setModal("snooze");
        break;
      case "move":
        setModal("move");
        break;
      case "labels":
        setModal("labels");
        break;
      case "permanent":
        setModal("permanent");
        break;
      case "print":
        setModal("print");
        break;
    }
  }
  function resetComposer() {
    setTo("");
    setCc("");
    setBcc("");
    setShowCc(false);
    setSubject("");
    setDraftBody("");
    setFiles([]);
    setFormatting([]);
    setComposeMode("new");
    setComposeFull(false);
  }
  function openCompose(mode: ComposeMode = "new", m?: Mail) {
    setCompose(true);
    setComposeMode(mode);
    setModal("none");
    setMenu(null);
    setSendFrom(m?.accountId || (account === "all" ? "personal" : account));
    setTo(mode === "reply" || mode === "replyAll" ? m?.address || "" : mode === "forward" ? "" : m?.address || "");
    setCc(mode === "replyAll" ? "team@example.com" : "");
    setShowCc(mode === "replyAll");
    setSubject(mode === "new" ? "" : mode === "forward" ? `Fwd: ${m?.subject || ""}` : mode === "draft" ? m?.subject || "" : `Re: ${m?.subject || ""}`);
    setDraftBody(mode === "new" ? "" : mode === "reply" || mode === "replyAll" ? `\n\n----- Pesan sebelumnya -----\n${m?.from}: ${m?.snippet || ""}` : mode === "forward" ? `\n\n----- Forwarded message -----\nDari: ${m?.from || ""}\n${m?.body || ""}` : m?.body || "");
    setFiles(mode === "draft" ? m?.attachments || [] : []);
    if (mode === "draft" && m) setSelectedMail(m.id);
  }
  function saveDraft() {
    const draft: Mail = {
      id: Date.now(),
      from: "Saya",
      address: accounts.find(a => a.id === sendFrom)?.email || "",
      subject: subject || "(Tanpa subjek)",
      snippet: draftBody || "Draf belum selesai",
      body: draftBody,
      date: "Hari ini",
      time: "Sekarang",
      accountId: sendFrom,
      category: "Utama",
      folder: "drafts",
      unread: false,
      starred: false,
      important: false,
      attachments: files,
      labels: [],
      avatar: "0",
      thread: 1
    };
    setMails(ms => [draft, ...ms]);
    setCompose(false);
    resetComposer();
    toastNow("Draf tersimpan. Buka folder Draf untuk melanjutkan.");
  }
  function sendMessage(isScheduled = false) {
    if (!to.trim() || !to.includes("@")) {
      toastNow("Masukkan alamat email penerima yang valid", "warning");
      return;
    }
    if (!subject.trim()) {
      toastNow("Tambahkan subjek sebelum mengirim", "warning");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      const sent: Mail = {
        id: Date.now(),
        from: "Saya",
        address: to,
        subject,
        body: draftBody,
        snippet: draftBody.slice(0, 130),
        date: "Hari ini",
        time: isScheduled ? `${dateVal} ${timeVal}` : "Sekarang",
        accountId: sendFrom,
        category: "Utama",
        folder: isScheduled ? "scheduled" : "sent",
        unread: false,
        starred: false,
        important: false,
        attachments: files,
        labels: [],
        avatar: "0",
        thread: 1
      };
      setMails(ms => [sent, ...ms]);
      setLoading(false);
      setCompose(false);
      setModal("none");
      resetComposer();
      toastNow(isScheduled ? `Email dijadwalkan untuk ${dateVal} pukul ${timeVal}` : "Email terkirim (simulasi prototipe)");
    }, 480);
  }
  function startConnect(p: "Gmail" | "Outlook") {
    setProvider(p);
    setOauthStage(1);
    setOauthEmail("");
    setModal("connectStep");
  }
  function completeConnect() {
    if (!oauthEmail.includes("@")) {
      toastNow("Masukkan alamat email untuk simulasi koneksi", "warning");
      return;
    }
    if (accounts.some(a => a.email.toLowerCase() === oauthEmail.toLowerCase())) {
      toastNow("Akun ini sudah terhubung", "warning");
      return;
    }
    const id = `new-${Date.now()}`;
    setAccounts(a => [...a, {
      id,
      email: oauthEmail,
      name: provider === "Gmail" ? "Gmail baru" : "Outlook baru",
      provider,
      color: provider === "Gmail" ? "#c6adff" : "#75b8ff",
      initials: provider === "Gmail" ? "G" : "O",
      online: true,
      unread: 0
    }]);
    setSelectedAcc(id);
    setModal("accountSuccess");
  }
  function confirmDisconnect() {
    if (accounts.length === 1) {
      toastNow("Minimal satu akun harus tetap terhubung", "warning");
      setModal("none");
      return;
    }
    setAccounts(xs => xs.filter(a => a.id !== selectedAcc));
    if (account === selectedAcc) setAccount("all");
    setModal("none");
    toastNow("Akun contoh berhasil dilepas");
  }
  function refresh() {
    setSyncState("Menyinkronkan");
    toastNow("Menyegarkan email contoh…", "info");
    setTimeout(() => {
      setSyncState("Terhubung");
      toastNow("Semua akun tersinkronisasi");
    }, 900);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tg = (e.target as HTMLElement)?.tagName;
      const typing = ["INPUT", "TEXTAREA"].includes(tg) || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "Escape") {
        setModal("none");
        setMenu(null);
        setShowSearchFilter(false);
        setSidebarOpen(false);
        setShowAccMenu(false);
        if (compose) setCompose(false);else setMobileReading(false);
      }
      if (typing || modal !== "none") return;
      if (e.key === "/" || e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key.toLowerCase() === "c" && !compose) {
        e.preventDefault();
        openCompose();
      }
      if (e.key.toLowerCase() === "s" && selectedMail && !compose) {
        e.preventDefault();
        handleAction("star");
      }
      if (e.key.toLowerCase() === "a" && selectedMail && !compose) {
        e.preventDefault();
        handleAction("archive");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [compose, selectedMail, mails, modal]);
  const countFor = (id: string) => id === "inbox" ? unreadCount : id === "drafts" ? mails.filter(m => m.folder === "drafts").length : id === "spam" ? mails.filter(m => m.folder === "spam").length : id === "scheduled" ? mails.filter(m => m.folder === "scheduled").length : 0;
  const title = folder.startsWith("label:") ? folder.slice(6) : FOLDERS.find(f => f.id === folder)?.label || "Semua inbox";
  const actIDs = selectedIds.length ? selectedIds : selectedMail ? [selectedMail] : [];
  const renderMail = (mail: Mail) => {
    const acct = accounts.find(a => a.id === mail.accountId);
    return <div key={mail.id} className={`au-mail-row ${selectedMail === mail.id ? "is-current" : ""} ${mail.unread ? "is-unread" : ""}`} onClick={() => openMail(mail.id)} role="button" tabIndex={0} onKeyDown={e => {
      if (e.key === "Enter") openMail(mail.id);
    }} aria-label={`Buka email ${mail.subject} dari ${mail.from}`} data-magicpath-id="119" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-mail-top" data-magicpath-id="120" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" title="Pilih pesan" checked={selectedIds.includes(mail.id)} onChange={e => setSelectedIds(s => e.target.checked ? [...s, mail.id] : s.filter(x => x !== mail.id))} onClick={e => e.stopPropagation()} className="au-check" data-magicpath-id="121" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Avatar name={mail.from} size={35} color={acct?.color} data-magicpath-id="122" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-mail-ident" data-magicpath-id="123" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-sender" data-magicpath-id="124" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mail.from}</span><span className="au-mail-address" data-magicpath-id="125" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mail.address}</span></div><span className="au-mail-time" data-magicpath-id="126" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mail.time}</span></div><div className="au-subject" data-magicpath-id="127" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mail.unread && <span className="au-unread-dot" data-magicpath-id="128" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />}{mail.subject}</div><div className="au-mail-snippet" data-magicpath-id="129" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mail.snippet}</div><div className="au-mail-bottom" data-magicpath-id="130" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-account-pill" style={{
          color: acct?.color,
          background: `${acct?.color || "#aaa"}19`
        }} data-magicpath-id="131" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-sm-dot" style={{
            background: acct?.color
          }} data-magicpath-id="132" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{acct?.name || "Akun"}</span><span className="au-category-dot" data-magicpath-id="133" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mail.category}</span><div className="au-mail-spacer" data-magicpath-id="134" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{mail.attachments.length > 0 && <I n="paperclip" size={13} data-magicpath-id="135" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />}<button className={`au-icon-au ${mail.starred ? "is-starred" : ""}`} onClick={e => {
          e.stopPropagation();
          handleAction("star", mail.id);
        }} title="Berbintang" data-magicpath-id="136" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="star" size={15} fill={mail.starred} data-magicpath-id="137" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div></div>;
  };
  return <div className={`aurora-app au-density-${density} ${theme === "Light" ? "au-theme-light" : ""}`} onClick={() => {}} data-magicpath-id="138" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">
 <div className="au-app-grid" data-magicpath-id="139" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">
  <aside className="au-rail" data-magicpath-id="140" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-logo-mark" title="Sela Aurora" data-magicpath-id="141" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="layers" size={21} data-magicpath-id="142" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><button className={`au-rail-icon ${view === "mail" && account === "all" ? "selected" : ""}`} onClick={() => nav("inbox", "all")} title="Semua akun" data-magicpath-id="143" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="inbox" size={19} data-magicpath-id="144" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>{accounts.map(a => <button key={a.id} onClick={() => nav("inbox", a.id)} className={`au-rail-account ${account === a.id ? "selected" : ""}`} title={a.email} style={{
          "--acc-color": a.color
        } as React.CSSProperties} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="145" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.initials}<span className={`au-rail-status ${a.online ? "live" : "error"}`} data-magicpath-repeat="external" data-magicpath-id="146" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>)}<button className="au-rail-icon au-rail-add" onClick={() => setModal("addAccount")} title="Tambah akun" data-magicpath-id="147" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="plus" data-magicpath-id="148" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><div className="au-rail-bottom" data-magicpath-id="149" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button className="au-rail-icon" onClick={() => navView("contacts")} title="Kontak" data-magicpath-id="150" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="users" data-magicpath-id="151" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button className="au-rail-icon" onClick={() => navView("calendar")} title="Kalender" data-magicpath-id="152" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="calendar" data-magicpath-id="153" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button className="au-rail-icon" onClick={() => navView("settings")} title="Pengaturan" data-magicpath-id="154" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="settings" data-magicpath-id="155" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button className="au-profile-avatar" onClick={() => setShowAccMenu(!showAccMenu)} title="Menu profil" data-magicpath-id="156" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">AR</button></div></aside>
  <aside className={`au-sidebar ${sidebarOpen ? "is-open" : ""}`} data-magicpath-id="157" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-brand" data-magicpath-id="158" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="159" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-brand-word" data-magicpath-id="160" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">sela<span className="au-brand-star" data-magicpath-id="161" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">✦</span></div><div className="au-brand-tag" data-magicpath-id="162" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">AURORA MAIL EXPERIENCE</div></div><button className="au-sidebar-close" onClick={() => setSidebarOpen(false)} data-magicpath-id="163" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" size={18} data-magicpath-id="164" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div>
    <button className="au-compose-trigger" onClick={() => openCompose()} data-magicpath-id="165" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="edit" size={18} data-magicpath-id="166" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="167" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tulis email</span><span className="au-keycap" data-magicpath-id="168" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">C</span></button>
    <div className="au-sidebar-scroll" data-magicpath-id="169" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-section-label" data-magicpath-id="170" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">MAILBOX</div><div className="au-nav-list" data-magicpath-id="171" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{FOLDERS.map(f => <button key={f.id} className={`au-nav-item ${view === "mail" && folder === f.id ? "active" : ""}`} onClick={() => nav(f.id)} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="172" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={f.icon} size={17} data-magicpath-repeat="external" data-magicpath-id="173" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="174" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{f.label}</span>{countFor(f.id) > 0 && <span className="au-nav-count" data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="175" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{countFor(f.id)}</span>}</button>)}</div>
    <div className="au-section-label au-label-header" data-magicpath-id="176" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span data-magicpath-id="177" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">LABEL</span><button onClick={() => {
              setEditLabel(null);
              setNewLabel("");
              setModal("newLabel");
            }} title="Tambah label" data-magicpath-id="178" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="plus" size={16} data-magicpath-id="179" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div><div className="au-nav-list au-label-list" data-magicpath-id="180" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{labelList.map((l, i) => <button key={l} className={`au-nav-item ${folder === `label:${l}` && view === "mail" ? "active" : ""}`} onClick={() => nav(`label:${l}`)} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="181" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-label-square" style={{
                background: ["#bca6ff", "#7bd9c0", "#f1bb82", "#80b6ff"][i % 4]
              }} data-magicpath-repeat="external" data-magicpath-id="182" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="183" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{l}</span></button>)}</div><div className="au-section-label au-label-header" data-magicpath-id="184" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span data-magicpath-id="185" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">AKUN TERHUBUNG</span><button onClick={() => setModal("addAccount")} title="Tambah akun" data-magicpath-id="186" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="plus" size={16} data-magicpath-id="187" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div><div className="au-account-sidebar" data-magicpath-id="188" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.map(a => <button key={a.id} onClick={() => nav("inbox", a.id)} className="au-sidebar-account" data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="189" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-provider-symbol" style={{
                color: a.provider === "Gmail" ? "#ffb3a8" : "#8dc8ff"
              }} data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="190" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.provider === "Gmail" ? "G" : "M"}</span><span data-magicpath-repeat="external" data-magicpath-id="191" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="192" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.name}</strong><small data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="193" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.email}</small></span><span className="au-sm-dot" style={{
                background: a.online ? "#85d7b5" : "#edb27d"
              }} data-magicpath-repeat="external" data-magicpath-id="194" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>)}</div><div className="au-section-label" data-magicpath-id="195" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">ALAT & TAMPILAN</div><div className="au-nav-list" data-magicpath-id="196" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button className="au-nav-item" onClick={() => navView("labels")} data-magicpath-id="197" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="tag" size={17} data-magicpath-id="198" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Kelola label</button><button className="au-nav-item" onClick={() => navView("rules")} data-magicpath-id="199" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="filter" size={17} data-magicpath-id="200" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Aturan inbox</button><button className="au-nav-item" onClick={() => navView("stateGallery")} data-magicpath-id="201" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="sparkles" size={17} data-magicpath-id="202" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Semua state UI</button></div></div>
    <div className="au-sidebar-footer" data-magicpath-id="203" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-storage-line" data-magicpath-id="204" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span data-magicpath-id="205" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Penyimpanan cloud</span><span data-magicpath-id="206" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">3.8 / 15 GB</span></div><div className="au-storage-track" data-magicpath-id="207" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span data-magicpath-id="208" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><button onClick={() => navView("accounts")} data-magicpath-id="209" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="settings" size={15} data-magicpath-id="210" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Kelola semua akun <I n="chevronRight" size={14} data-magicpath-id="211" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div>
  </aside>
  <div className="au-main-shell" data-magicpath-id="212" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><header className="au-topbar" data-magicpath-id="213" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button className="au-topbar-menu" title="Buka menu" onClick={() => setSidebarOpen(!sidebarOpen)} data-magicpath-id="214" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="menu" data-magicpath-id="215" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><div className="au-search-box" data-magicpath-id="216" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="search" size={18} data-magicpath-id="217" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><input ref={searchRef} value={search} onChange={e => {
              setSearch(e.target.value);
              setQuery(e.target.value);
              if (e.target.value) {
                setView("mail");
                setFolder("all");
              }
            }} placeholder="Cari di semua akun..." aria-label="Cari email" data-magicpath-id="218" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span className="au-keycap" data-magicpath-id="219" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">⌘ K</span>{search && <button onClick={() => {
              setSearch("");
              setQuery("");
            }} aria-label="Hapus pencarian" data-magicpath-id="220" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" size={15} data-magicpath-id="221" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>}</div><Btn icon="sliders" title="Filter pencarian" onClick={() => {
            setShowSearchFilter(!showSearchFilter);
            setView("mail");
          }} active={showSearchFilter} data-magicpath-id="222" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-topbar-gap" data-magicpath-id="223" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><button className="au-sync-status" onClick={refresh} data-magicpath-id="224" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className={`au-sm-dot ${syncState === "Menyinkronkan" ? "au-pulse" : ""}`} data-magicpath-id="225" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{syncState === "Terhubung" ? `${accounts.filter(a => a.online).length} akun terhubung` : syncState}<I n="refresh" size={14} data-magicpath-id="226" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><Btn icon="bell" title="Notifikasi" onClick={() => {
            navView("notifications");
            setUnreadNotifs(0);
          }} data-magicpath-id="227" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="help" title="Bantuan" onClick={() => setModal("help")} data-magicpath-id="228" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><button className="au-user-button" onClick={() => setShowAccMenu(!showAccMenu)} title="Profil Alex Ramadhan" data-magicpath-id="229" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">AR <I n="chevronDown" size={13} data-magicpath-id="230" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></header>
  {showAccMenu && <div className="au-profile-menu au-flyout" data-magicpath-id="231" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-flyout-heading" data-magicpath-id="232" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Alex Ramadhan <small data-magicpath-id="233" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pengguna Sela Aurora</small></div><button onClick={() => navView("accounts")} data-magicpath-id="234" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="users" data-magicpath-id="235" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Kelola akun</button><button onClick={() => navView("settings")} data-magicpath-id="236" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="settings" data-magicpath-id="237" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Pengaturan</button><button onClick={() => setModal("shortcuts")} data-magicpath-id="238" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="keyboard" data-magicpath-id="239" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Pintasan keyboard</button><button onClick={() => {
            setShowAccMenu(false);
            toastNow("Mode demo: tidak ada sesi sungguhan untuk keluar", "info");
          }} data-magicpath-id="240" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="lock" data-magicpath-id="241" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Keluar (demo)</button></div>}
  {showSearchFilter && <div className="au-search-popover au-flyout" data-magicpath-id="242" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-flyout-title" data-magicpath-id="243" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pencarian lanjutan <button onClick={() => setShowSearchFilter(false)} data-magicpath-id="244" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" data-magicpath-id="245" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div><label data-magicpath-id="246" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Dari / Pengirim<input value={filterFrom} onChange={e => setFilterFrom(e.target.value)} placeholder="nama atau email" data-magicpath-id="247" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label><div className="au-form-grid" data-magicpath-id="248" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label data-magicpath-id="249" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Akun<select value={filterAccount} onChange={e => setFilterAccount(e.target.value)} data-magicpath-id="250" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><option value="all" data-magicpath-id="251" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Semua akun</option>{accounts.map(a => <option key={a.id} value={a.id} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="252" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.name}</option>)}</select></label><label data-magicpath-id="253" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Waktu<select value={filterDate} onChange={e => setFilterDate(e.target.value)} data-magicpath-id="254" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><option value="any" data-magicpath-id="255" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kapan saja</option><option value="today" data-magicpath-id="256" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Hari ini</option><option value="week" data-magicpath-id="257" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">7 hari terakhir</option></select></label></div><label className="au-toggle-line" data-magicpath-id="258" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={filterAttachment} onChange={e => setFilterAttachment(e.target.checked)} data-magicpath-id="259" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Ada lampiran</label><label className="au-toggle-line" data-magicpath-id="260" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={onlyUnread} onChange={e => setOnlyUnread(e.target.checked)} data-magicpath-id="261" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Belum dibaca</label><div className="au-flyout-actions" data-magicpath-id="262" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Reset" onClick={() => {
              setFilterFrom("");
              setFilterAccount("all");
              setFilterDate("any");
              setFilterAttachment(false);
              setOnlyUnread(false);
              setQuery("");
              setSearch("");
            }} data-magicpath-id="263" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn label="Tampilkan hasil" icon="search" variant="primary" onClick={() => {
              setView("mail");
              setFolder("all");
              setShowSearchFilter(false);
            }} data-magicpath-id="264" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></div>}
  {view === "mail" ? <div className={`au-mail-layout ${mobileReading ? "au-mobile-reading" : ""} ${!previewPane ? "au-list-expanded" : ""}`} data-magicpath-id="265" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">
     <section className="au-message-column" data-magicpath-id="266" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-mail-header" data-magicpath-id="267" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="268" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="layers" size={13} data-magicpath-id="269" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> {account === "all" ? "SEMUA AKUN" : selectedAccount?.provider.toUpperCase() + "  /  " + selectedAccount?.name.toUpperCase()}</div><div className="au-heading-row" data-magicpath-id="270" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="271" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><h1 data-magicpath-id="272" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{query ? "Hasil pencarian" : title}</h1><p data-magicpath-id="273" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{shownMails.length} pesan · {shownMails.filter(m => m.unread).length} belum dibaca</p></div><button className="au-round-button" title="Sinkronkan" onClick={refresh} data-magicpath-id="274" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="refresh" size={17} data-magicpath-id="275" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div></div>
     {(folder === "inbox" || folder === "all") && <div className="au-categories" data-magicpath-id="276" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{CATEGORY.map(c => <button key={c} onClick={() => {
                setCategory(c);
                setSelectedMail(null);
                setMobileReading(false);
              }} className={category === c ? "active" : ""} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="277" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{c}</button>)}</div>}
     <div className="au-list-toolbar" data-magicpath-id="278" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selectedIds.length > 0 ? <><button title="Batalkan pilihan" onClick={() => setSelectedIds([])} data-magicpath-id="279" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" size={15} data-magicpath-id="280" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{selectedIds.length} dipilih</button><Btn icon="archive" title="Arsipkan" size="small" onClick={() => handleAction("archive")} data-magicpath-id="281" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="trash" title="Hapus" size="small" onClick={() => handleAction("trash")} data-magicpath-id="282" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="mail" title="Tandai belum dibaca" size="small" onClick={() => handleAction("unread")} data-magicpath-id="283" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="tag" title="Label" size="small" onClick={() => handleAction("labels")} data-magicpath-id="284" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></> : <><button onClick={() => setSelectedIds(shownMails.map(m => m.id))} title="Pilih semua" data-magicpath-id="285" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-checkbox-look" data-magicpath-id="286" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> <span data-magicpath-id="287" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pilih</span></button><span className="au-toolbar-divider" data-magicpath-id="288" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><button onClick={() => {
                  setOnlyUnread(!onlyUnread);
                  toastNow(!onlyUnread ? "Filter belum dibaca aktif" : "Filter belum dibaca dinonaktifkan", "info");
                }} className={onlyUnread ? "active" : ""} data-magicpath-id="289" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="mail" size={15} data-magicpath-id="290" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Belum dibaca</button><div className="au-spacer" data-magicpath-id="291" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><select className="au-sort" value={sort} onChange={e => setSort(e.target.value)} title="Urutkan" data-magicpath-id="292" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><option value="newest" data-magicpath-id="293" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Terbaru</option><option value="oldest" data-magicpath-id="294" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Terlama</option><option value="sender" data-magicpath-id="295" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pengirim A–Z</option></select></>}</div>
     {stateDemo === "loading" ? <div className="au-messages-scroll" data-magicpath-id="296" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{Array.from({
                length: 7
              }, (_, i) => <div className="au-skeleton-mail" key={i} data-magicpath-id="297" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span data-magicpath-id="298" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><i data-magicpath-id="299" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><i data-magicpath-id="300" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><i data-magicpath-id="301" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>)}</div> : stateDemo === "error" || stateDemo === "offline" ? <div className="au-empty" data-magicpath-id="302" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-empty-illustration" data-magicpath-id="303" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={stateDemo === "offline" ? "wifiOff" : "alert"} size={32} data-magicpath-id="304" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></span><h3 data-magicpath-id="305" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{stateDemo === "offline" ? "Kamu sedang offline" : "Gagal memuat email"}</h3><p data-magicpath-id="306" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{stateDemo === "offline" ? "Periksa koneksi internet. Pesan sebelumnya tetap tersedia." : "Ada gangguan saat mengambil email. Coba lagi."}</p><Btn icon="refresh" label="Coba lagi" variant="primary" onClick={() => {
                setStateDemo("loading");
                setTimeout(() => {
                  setStateDemo("normal");
                  toastNow("Pesan berhasil dimuat");
                }, 750);
              }} data-magicpath-id="307" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div> : shownMails.length ? <div className="au-messages-scroll" data-magicpath-id="308" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{shownMails.map(renderMail)}<div className="au-list-end" data-magicpath-id="309" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="checkCircle" size={15} data-magicpath-id="310" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Kamu sudah melihat semua pesan</div></div> : <div className="au-empty" data-magicpath-id="311" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-empty-illustration" data-magicpath-id="312" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={folder === "trash" ? "trash" : folder === "starred" ? "star" : "inbox"} size={32} data-magicpath-id="313" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></span><h3 data-magicpath-id="314" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{query ? "Tidak ada hasil ditemukan" : folder === "trash" ? "Sampah sudah kosong" : "Tidak ada pesan di sini"}</h3><p data-magicpath-id="315" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{query ? "Coba kata kunci lain atau hapus filter pencarian." : "Pesan yang sesuai akan muncul di sini."}</p><Btn icon={query ? "x" : "refresh"} label={query ? "Bersihkan pencarian" : "Segarkan"} variant="secondary" onClick={() => {
                if (query) {
                  setQuery("");
                  setSearch("");
                  setFilterFrom("");
                  setFilterAttachment(false);
                } else refresh();
              }} data-magicpath-id="316" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>}
     {folder === "trash" && shownMails.length > 0 && <button className="au-trash-empty" onClick={() => setModal("emptyTrash")} data-magicpath-id="317" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="trash" size={15} data-magicpath-id="318" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Kosongkan Sampah</button>}
     </section>
     {previewPane && <section className="au-reading-column" data-magicpath-id="319" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected ? <><div className="au-reader-toolbar" data-magicpath-id="320" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button className="au-back-mobile" onClick={() => setMobileReading(false)} title="Kembali ke inbox" data-magicpath-id="321" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="chevronLeft" data-magicpath-id="322" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Inbox</button><div className="au-reader-tools" data-magicpath-id="323" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn icon="archive" title="Arsipkan" onClick={() => handleAction("archive")} data-magicpath-id="324" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="shield" title={selected.folder === "spam" ? "Bukan spam" : "Laporkan spam"} onClick={() => handleAction(selected.folder === "spam" ? "notSpam" : "spam")} data-magicpath-id="325" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="trash" title={selected.folder === "trash" ? "Hapus permanen" : "Pindahkan ke Sampah"} onClick={() => handleAction(selected.folder === "trash" ? "permanent" : "trash")} data-magicpath-id="326" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span className="au-toolbar-divider" data-magicpath-id="327" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="mail" title="Tandai belum dibaca" onClick={() => handleAction("unread")} data-magicpath-id="328" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="clock" title="Tunda" onClick={() => handleAction("snooze")} data-magicpath-id="329" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="folder" title="Pindahkan" onClick={() => handleAction("move")} data-magicpath-id="330" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="tag" title="Label" onClick={() => handleAction("labels")} data-magicpath-id="331" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-relative" data-magicpath-id="332" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn icon="more" title="Tindakan lainnya" onClick={() => setMenu(menu === "more" ? null : "more")} data-magicpath-id="333" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{menu === "more" && <div className="au-dropdown au-reader-dropdown" data-magicpath-id="334" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{[{
                        i: "star" as IconName,
                        l: "Beri / hapus bintang",
                        a: "star",
                        mpid: "mp_cc59468a2856a5d0a227aabc"
                      }, {
                        i: "flag" as IconName,
                        l: "Tandai penting",
                        a: "important",
                        mpid: "mp_886e20dc655dc66af0f30025"
                      }, {
                        i: "printer" as IconName,
                        l: "Cetak",
                        a: "print",
                        mpid: "mp_3147e8ff05159e770811f699"
                      }, {
                        i: "eye" as IconName,
                        l: "Lihat detail pengirim",
                        a: "sender",
                        mpid: "mp_c4672bebb5d68e68322118b8"
                      }].map(x => <button key={x.l} onClick={() => {
                        setMenu(null);
                        if (x.a === "sender") setModal("sender");else handleAction(x.a);
                      }} data-magicpath-repeat="literal" data-magicpath-repeat-root="true" data-magicpath-uuid={(x as any).mpid} data-magicpath-binding="derived" data-magicpath-id="335" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={x.i} size={15} data-magicpath-repeat="literal" data-magicpath-id="336" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{x.l}</button>)}</div>}</div></div><div className="au-message-pos" data-magicpath-id="337" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">1 dari {shownMails.length} <button title="Pesan sebelumnya" onClick={() => {
                    const ix = shownMails.findIndex(m => m.id === selected.id);
                    openMail(shownMails[Math.max(0, ix - 1)]?.id || selected.id);
                  }} data-magicpath-id="338" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="chevronLeft" size={15} data-magicpath-id="339" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button title="Pesan berikutnya" onClick={() => {
                    const ix = shownMails.findIndex(m => m.id === selected.id);
                    openMail(shownMails[Math.min(shownMails.length - 1, ix + 1)]?.id || selected.id);
                  }} data-magicpath-id="340" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="chevronRight" size={15} data-magicpath-id="341" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div></div>
      <div className="au-reader-scroll" data-magicpath-id="342" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-reader-content" data-magicpath-id="343" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-reader-status" data-magicpath-id="344" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-category-badge" data-magicpath-id="345" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.category}</span><span style={{
                      background: `${accounts.find(a => a.id === selected.accountId)?.color}20`,
                      color: accounts.find(a => a.id === selected.accountId)?.color
                    }} className="au-category-badge" data-magicpath-id="346" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.find(a => a.id === selected.accountId)?.name}</span><div className="au-spacer" data-magicpath-id="347" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="star" title="Berbintang" active={selected.starred} onClick={() => handleAction("star")} data-magicpath-id="348" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><h2 data-magicpath-id="349" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.subject}</h2>{selected.thread > 1 && <button className="au-conversation-chip" onClick={() => setExpandedThread(!expandedThread)} data-magicpath-id="350" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="users" size={13} data-magicpath-id="351" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{selected.thread} pesan dalam percakapan <I n="chevronDown" size={14} data-magicpath-id="352" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>}{expandedThread && <div className="au-thread-summary" data-magicpath-id="353" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="354" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pesan sebelumnya</strong><p data-magicpath-id="355" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pesan awal — ringkasan percakapan terkait {selected.subject}.</p><p data-magicpath-id="356" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Balasan terbaru — diskusi telah diperbarui dengan informasi baru.</p></div>}<div className="au-reader-person" data-magicpath-id="357" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Avatar name={selected.from} size={45} color={accounts.find(a => a.id === selected.accountId)?.color} data-magicpath-id="358" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-person-details" data-magicpath-id="359" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="360" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="361" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.from}</strong><span data-magicpath-id="362" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.time} · {selected.date}</span></div><p data-magicpath-id="363" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.address} <button onClick={() => setShowDetails(!showDetails)} data-magicpath-id="364" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">kepada saya <I n="chevronDown" size={13} data-magicpath-id="365" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></p></div><div className="au-reader-person-actions" data-magicpath-id="366" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn icon="reply" title="Balas" onClick={() => openCompose("reply", selected)} data-magicpath-id="367" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="more" title="Info pengirim" onClick={() => setModal("sender")} data-magicpath-id="368" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></div>{showDetails && <div className="au-sender-details" data-magicpath-id="369" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="370" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Dari: <strong data-magicpath-id="371" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.from} &lt;{selected.address}&gt;</strong></div><div data-magicpath-id="372" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Ke: <strong data-magicpath-id="373" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.find(a => a.id === selected.accountId)?.email}</strong></div><div data-magicpath-id="374" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tanggal: <strong data-magicpath-id="375" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.date} · {selected.time}</strong></div><button onClick={() => {
                      navigator.clipboard?.writeText(selected.address);
                      toastNow("Alamat pengirim disalin");
                    }} data-magicpath-id="376" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="copy" size={13} data-magicpath-id="377" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Salin alamat</button></div>}
       <div className="au-message-body" data-magicpath-id="378" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.newsletter && <div className="au-newsletter" data-magicpath-id="379" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-newsletter-eyebrow" data-magicpath-id="380" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">AURORA STUDIO · DESIGN JOURNAL</div><div className="au-newsletter-title" data-magicpath-id="381" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Good ideas deserve<br data-magicpath-id="382" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />good spaces<span data-magicpath-id="383" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">.</span></div><p data-magicpath-id="384" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Fresh perspectives, creative places, and the people building a brighter everyday.</p><div className="au-newsletter-img" style={{
                        backgroundImage: `url(${selected.photo || PHOTO.workspace})`
                      }} data-magicpath-id="385" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-newsletter-foot" data-magicpath-id="386" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">ISSUE 018 &nbsp; • &nbsp; INSPIRATION FOR WHAT'S NEXT</div></div>}{selected.body.split("\n").map((line, i) => <p key={i} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="387" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{line || "\u00a0"}</p>)}{!selected.newsletter && selected.id === 9 && <div className="au-image-triptych" data-magicpath-id="388" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{[PHOTO.travel, PHOTO.coffee, PHOTO.interior].map((img, i) => <button key={i} onClick={() => {
                        setActiveImage(i);
                        setModal("attachments");
                      }} title="Buka foto" data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="389" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><img src={img} alt={`Foto galeri ${i + 1}`} data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="390" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>)}</div>}</div>
       {selected.attachments.length > 0 && <div className="au-attachments" data-magicpath-id="391" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-attachments-title" data-magicpath-id="392" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="paperclip" size={17} data-magicpath-id="393" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> {selected.attachments.length} lampiran <span data-magicpath-id="394" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">· Preview prototipe</span></div><div className="au-attachment-grid" data-magicpath-id="395" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.attachments.map((name, i) => <button key={name} className="au-attachment" onClick={() => {
                        setActiveImage(i);
                        setModal("attachments");
                      }} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="396" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-attach-thumb" data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="397" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{name.endsWith(".png") ? <img src={PHOTO.workspace} alt="Thumbnail lampiran" data-magicpath-repeat="external" data-magicpath-id="398" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> : <I n="file" size={24} data-magicpath-repeat="external" data-magicpath-id="399" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />}</div><span data-magicpath-repeat="external" data-magicpath-id="400" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="401" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{name}</strong><small data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="402" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{name.endsWith(".pdf") ? "PDF Document" : "Image"} · Contoh</small></span><I n="eye" size={15} data-magicpath-repeat="external" data-magicpath-id="403" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>)}</div></div>}
       <div className="au-message-signature" data-magicpath-id="404" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-signature-avatar" data-magicpath-id="405" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.from.slice(0, 1)}</div><strong data-magicpath-id="406" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.from}</strong><span data-magicpath-id="407" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.from.includes("Studio") ? "Design & creative team" : "Sela conversation"}</span></div><div className="au-reply-actions" data-magicpath-id="408" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn icon="reply" label="Balas" variant="primary" onClick={() => openCompose("reply", selected)} data-magicpath-id="409" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="replyAll" label="Balas semua" variant="secondary" onClick={() => openCompose("replyAll", selected)} data-magicpath-id="410" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="forward" label="Teruskan" variant="secondary" onClick={() => openCompose("forward", selected)} data-magicpath-id="411" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></div></div></> : <div className="au-reader-placeholder" data-magicpath-id="412" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-reader-blank-icon" data-magicpath-id="413" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="mail" size={29} data-magicpath-id="414" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><h2 data-magicpath-id="415" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tempat untuk percakapan terbaik.</h2><p data-magicpath-id="416" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pilih pesan dari daftar untuk membaca, membalas, atau melihat lampirannya tanpa meninggalkan inbox.</p><div className="au-empty-shortcut" data-magicpath-id="417" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tekan <span className="au-keycap" data-magicpath-id="418" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">C</span> untuk menulis email baru</div></div>}</section>}
  </div> : <div className="au-page-scroll" data-magicpath-id="419" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{view === "accounts" ? <><div className="au-page-heading" data-magicpath-id="420" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="421" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="422" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">PREFERENSI / AKUN</div><h1 data-magicpath-id="423" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Semua akun, satu tempat.</h1><p data-magicpath-id="424" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kelola akun Gmail dan Outlook secara terpisah dan tetap terhubung.</p></div><Btn icon="plus" label="Tambah akun" variant="primary" onClick={() => setModal("addAccount")} data-magicpath-id="425" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-stat-grid" data-magicpath-id="426" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-stat-card" data-magicpath-id="427" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="users" data-magicpath-id="428" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="429" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Akun terhubung</span><strong data-magicpath-id="430" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.length}</strong></div><div className="au-stat-card" data-magicpath-id="431" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="mail" data-magicpath-id="432" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="433" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pesan di semua akun</span><strong data-magicpath-id="434" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mails.length}</strong></div><div className="au-stat-card" data-magicpath-id="435" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="refresh" data-magicpath-id="436" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="437" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Status sinkronisasi</span><strong style={{
                  fontSize: 20
                }} data-magicpath-id="438" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Aktif</strong></div></div><div className="au-page-card" data-magicpath-id="439" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-card-head" data-magicpath-id="440" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="441" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><h3 data-magicpath-id="442" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Akun email</h3><p data-magicpath-id="443" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Masing-masing akun mempunyai folder dan alamat pengirim sendiri.</p></div><Btn icon="refresh" label="Sinkronkan semua" onClick={refresh} data-magicpath-id="444" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>{accounts.map(a => <div className="au-account-row" key={a.id} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="445" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-provider-badge" style={{
                  background: a.provider === "Gmail" ? "#473034" : "#193349",
                  color: a.provider === "Gmail" ? "#ffb6a5" : "#8ac6ff"
                }} data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="446" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.provider === "Gmail" ? "G" : "M"}</div><div className="au-acc-info" data-magicpath-repeat="external" data-magicpath-id="447" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="448" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.name} <span data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="449" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">· {a.provider}</span></strong><p data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="450" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.email}</p><small data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="451" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className={`au-sm-dot ${a.online ? "" : "is-offline"}`} data-magicpath-repeat="external" data-magicpath-id="452" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{a.online ? "Terhubung dan tersinkronisasi" : "Perlu menghubungkan kembali"}</small></div><button className="au-text-link" onClick={() => nav("inbox", a.id)} data-magicpath-repeat="external" data-magicpath-id="453" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Lihat inbox <I n="arrowRight" size={14} data-magicpath-repeat="external" data-magicpath-id="454" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><Btn icon="settings" title="Pengaturan akun" onClick={() => {
                  setSelectedAcc(a.id);
                  setSettingTab("Akun");
                  navView("settings");
                }} data-magicpath-repeat="external" data-magicpath-id="455" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="more" title="Opsi akun" onClick={() => {
                  setSelectedAcc(a.id);
                  setMenu(menu === `account-${a.id}` ? null : `account-${a.id}`);
                }} data-magicpath-repeat="external" data-magicpath-id="456" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{menu === `account-${a.id}` && <div className="au-account-flyout au-dropdown" data-magicpath-repeat="external" data-magicpath-id="457" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button onClick={() => {
                    setAccounts(xs => xs.map(x => x.id === a.id ? {
                      ...x,
                      online: !x.online
                    } : x));
                    setMenu(null);
                    toastNow("Status akun demo diubah", "info");
                  }} data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="458" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="refresh" data-magicpath-repeat="external" data-magicpath-id="459" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> {a.online ? "Simulasikan izin kedaluwarsa" : "Aktifkan koneksi"}</button><button onClick={() => {
                    setModal("reconnect");
                    setMenu(null);
                  }} data-magicpath-repeat="external" data-magicpath-id="460" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="lock" data-magicpath-repeat="external" data-magicpath-id="461" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Hubungkan ulang</button><button onClick={() => {
                    setModal("disconnect");
                    setMenu(null);
                  }} className="au-danger-text" data-magicpath-repeat="external" data-magicpath-id="462" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="trash" data-magicpath-repeat="external" data-magicpath-id="463" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Lepaskan akun</button></div>}</div>)}</div><div className="au-two-cards" data-magicpath-id="464" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-page-card au-info-feature" data-magicpath-id="465" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-feature-icon" data-magicpath-id="466" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="shield" size={25} data-magicpath-id="467" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></span><h3 data-magicpath-id="468" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Privasi tetap utama.</h3><p data-magicpath-id="469" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Prototype ini menggunakan data email fiktif. Tidak ada koneksi Gmail atau Microsoft yang sebenarnya.</p><Btn label="Pengaturan keamanan" icon="arrowRight" onClick={() => {
                  setSettingTab("Privasi & keamanan");
                  navView("settings");
                }} data-magicpath-id="470" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-page-card au-info-feature" data-magicpath-id="471" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-feature-icon mint" data-magicpath-id="472" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="cloud" size={25} data-magicpath-id="473" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></span><h3 data-magicpath-id="474" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Sinkronisasi terpadu.</h3><p data-magicpath-id="475" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pilih akun individual tanpa logout. Setiap email tetap menampilkan asal akun dengan warna berbeda.</p><Btn label="Buka unified inbox" icon="arrowRight" onClick={() => nav("inbox", "all")} data-magicpath-id="476" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></div></> : null}
  {view === "settings" ? <><div className="au-page-heading" data-magicpath-id="477" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="478" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="479" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">PERSONALISASI</div><h1 data-magicpath-id="480" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pengaturan</h1><p data-magicpath-id="481" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Ubah cara Sela Aurora bekerja sesuai preferensimu.</p></div></div><div className="au-settings-layout" data-magicpath-id="482" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-settings-nav" data-magicpath-id="483" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{["Umum", "Tampilan", "Akun", "Notifikasi", "Tanda tangan", "Sinkronisasi", "Privasi & keamanan", "Aksesibilitas", "Pintasan", "Tentang"].map((x, i) => <button key={x} className={settingTab === x ? "active" : ""} onClick={() => setSettingTab(x)} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="484" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={(["settings", "palette", "users", "bell", "edit", "refresh", "lock", "eye", "keyboard", "info"] as IconName[])[i]} size={17} data-magicpath-repeat="external" data-magicpath-id="485" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{x}</button>)}</div><div className="au-page-card au-settings-panel" data-magicpath-id="486" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-card-head" data-magicpath-id="487" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="488" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><h3 data-magicpath-id="489" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{settingTab}</h3><p data-magicpath-id="490" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pengaturan {settingTab.toLowerCase()} untuk pengalaman emailmu.</p></div></div>{settingTab === "Umum" && <><div className="au-field-row" data-magicpath-id="491" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="492" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="493" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Bahasa aplikasi</strong><p data-magicpath-id="494" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Bahasa yang digunakan pada antarmuka.</p></div><select defaultValue="id" data-magicpath-id="495" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><option value="id" data-magicpath-id="496" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Bahasa Indonesia</option><option value="en" data-magicpath-id="497" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">English</option></select></div><div className="au-field-row" data-magicpath-id="498" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="499" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="500" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Zona waktu</strong><p data-magicpath-id="501" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tampilkan jadwal dan tanggal mengikuti zona waktu.</p></div><select defaultValue="wib" data-magicpath-id="502" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><option value="wib" data-magicpath-id="503" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Asia/Jakarta (WIB)</option><option value="utc" data-magicpath-id="504" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">UTC</option></select></div><div className="au-field-row" data-magicpath-id="505" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="506" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="507" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Panel baca pesan</strong><p data-magicpath-id="508" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Baca pesan di samping daftar email pada desktop.</p></div><label className="au-switch" data-magicpath-id="509" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={previewPane} onChange={e => setPreviewPane(e.target.checked)} data-magicpath-id="510" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="511" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><div className="au-field-row" data-magicpath-id="512" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="513" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="514" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pengirim default</strong><p data-magicpath-id="515" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Akun yang dipilih saat menulis email baru.</p></div><select value={sendFrom} onChange={e => setSendFrom(e.target.value)} data-magicpath-id="516" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.map(a => <option key={a.id} value={a.id} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="517" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.name}</option>)}</select></div></>}
  {settingTab === "Tampilan" && <><h4 data-magicpath-id="518" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tema</h4><div className="au-theme-cards" data-magicpath-id="519" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{["Aurora Dark", "Midnight", "Light"].map(t => <button key={t} className={theme === t ? "active" : ""} onClick={() => {
                      setTheme(t);
                      toastNow(`Tema ${t} diterapkan`);
                    }} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="520" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className={`au-theme-preview au-preview-${t.replace(" ", "").toLowerCase()}`} data-magicpath-repeat="external" data-magicpath-id="521" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span data-magicpath-repeat="external" data-magicpath-id="522" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-repeat="external" data-magicpath-id="523" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-repeat="external" data-magicpath-id="524" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="525" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{t}</strong><small data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="526" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{theme === t ? "✓ Aktif" : "Pilih tema"}</small></button>)}</div><h4 data-magicpath-id="527" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kepadatan daftar</h4><div className="au-segmented" data-magicpath-id="528" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{["compact", "comfortable", "spacious"].map(t => <button className={density === t ? "active" : ""} onClick={() => setDensity(t)} key={t} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="529" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{t === "compact" ? "Ringkas" : t === "comfortable" ? "Nyaman" : "Lapang"}</button>)}</div><div className="au-field-row" data-magicpath-id="530" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="531" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="532" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Panel pembaca</strong><p data-magicpath-id="533" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tampilkan panel pembaca di samping daftar.</p></div><label className="au-switch" data-magicpath-id="534" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={previewPane} onChange={e => setPreviewPane(e.target.checked)} data-magicpath-id="535" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="536" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div></>}
  {settingTab === "Akun" && <><p className="au-setting-intro" data-magicpath-id="537" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Lihat akun terhubung atau pilih akun untuk menjadi pengirim default.</p>{accounts.map(a => <div className="au-field-row" key={a.id} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="538" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-repeat="external" data-magicpath-id="539" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="540" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.name} · {a.provider}</strong><p data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="541" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.email}</p></div><Btn icon={sendFrom === a.id ? "check" : "mail"} label={sendFrom === a.id ? "Default" : "Jadikan default"} variant={sendFrom === a.id ? "primary" : "secondary"} onClick={() => {
                      setSendFrom(a.id);
                      toastNow(`${a.name} menjadi pengirim default`);
                    }} data-magicpath-repeat="external" data-magicpath-id="542" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>)}<Btn icon="users" label="Kelola semua akun" onClick={() => navView("accounts")} data-magicpath-id="543" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>}
  {settingTab === "Notifikasi" && <><div className="au-field-row" data-magicpath-id="544" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="545" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="546" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Notifikasi desktop</strong><p data-magicpath-id="547" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tampilkan pemberitahuan pesan masuk (simulasi).</p></div><label className="au-switch" data-magicpath-id="548" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={notifications} onChange={e => setNotifications(e.target.checked)} data-magicpath-id="549" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="550" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><div className="au-field-row" data-magicpath-id="551" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="552" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="553" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Suara notifikasi</strong><p data-magicpath-id="554" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Indikator preferensi suara.</p></div><label className="au-switch" data-magicpath-id="555" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} data-magicpath-id="556" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="557" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><Btn icon="bell" label="Pratinjau notifikasi" onClick={() => toastNow("Email baru dari Nadia Putri · Contoh notifikasi", "info")} data-magicpath-id="558" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>}
  {settingTab === "Tanda tangan" && <><label className="au-setting-label" data-magicpath-id="559" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tanda tangan untuk email baru</label><textarea className="au-setting-textarea" value={sigText} onChange={e => setSigText(e.target.value)} rows={6} data-magicpath-id="560" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-field-row" data-magicpath-id="561" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="562" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="563" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Sertakan otomatis</strong><p data-magicpath-id="564" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tanda tangan ditambahkan ke pesan baru.</p></div><label className="au-switch" data-magicpath-id="565" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={signature} onChange={e => setSignature(e.target.checked)} data-magicpath-id="566" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="567" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><Btn label="Simpan perubahan" icon="check" variant="primary" onClick={() => toastNow("Pengaturan tanda tangan tersimpan")} data-magicpath-id="568" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>}
  {settingTab === "Sinkronisasi" && <><div className="au-field-row" data-magicpath-id="569" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="570" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="571" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Sinkronisasi otomatis</strong><p data-magicpath-id="572" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Contoh pemutakhiran pesan berkala.</p></div><label className="au-switch" data-magicpath-id="573" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={autorefresh} onChange={e => setAutorefresh(e.target.checked)} data-magicpath-id="574" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="575" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><div className="au-field-row" data-magicpath-id="576" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="577" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="578" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Interval sinkronisasi</strong><p data-magicpath-id="579" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Hanya pengaturan antarmuka prototype.</p></div><select data-magicpath-id="580" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><option data-magicpath-id="581" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Setiap 5 menit</option><option data-magicpath-id="582" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Setiap 15 menit</option><option data-magicpath-id="583" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Manual</option></select></div><Btn icon="refresh" label="Sinkronkan sekarang" variant="primary" onClick={refresh} data-magicpath-id="584" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>}
  {settingTab === "Privasi & keamanan" && <><div className="au-security-banner" data-magicpath-id="585" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="shield" size={28} data-magicpath-id="586" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div data-magicpath-id="587" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="588" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Prototype aman untuk pengujian UI</strong><p data-magicpath-id="589" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tidak mengirim email sungguhan, tidak menyimpan password, dan tidak mengakses token OAuth.</p></div></div><div className="au-field-row" data-magicpath-id="590" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="591" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="592" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Perangkat & sesi</strong><p data-magicpath-id="593" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Simulasi daftar sesi login.</p></div><Btn label="Lihat aktivitas" icon="eye" onClick={() => toastNow("Mode demo: tidak ada sesi nyata", "info")} data-magicpath-id="594" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-field-row" data-magicpath-id="595" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="596" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="597" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Keamanan koneksi</strong><p data-magicpath-id="598" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Koneksi mock Gmail & Outlook.</p></div><Btn label="Kelola izin" onClick={() => navView("accounts")} data-magicpath-id="599" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
  {settingTab === "Aksesibilitas" && <><div className="au-field-row" data-magicpath-id="600" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="601" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="602" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kurangi animasi</strong><p data-magicpath-id="603" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Gunakan transisi yang lebih singkat.</p></div><label className="au-switch" data-magicpath-id="604" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" onChange={e => document.documentElement.classList.toggle("au-reduced-motion", e.target.checked)} data-magicpath-id="605" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="606" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><div className="au-field-row" data-magicpath-id="607" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="608" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="609" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kontras tinggi</strong><p data-magicpath-id="610" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Perkuat outline kontrol yang aktif.</p></div><label className="au-switch" data-magicpath-id="611" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" onChange={e => document.documentElement.classList.toggle("au-high-contrast", e.target.checked)} data-magicpath-id="612" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="613" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div></>}
  {settingTab === "Pintasan" && <><div className="au-shortcut-grid" data-magicpath-id="614" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{[["C", "Tulis email"], ["/", "Cari email"], ["⌘ K", "Fokus pencarian"], ["S", "Bintang pesan"], ["A", "Arsipkan pesan"], ["Esc", "Tutup modal"]].map(x => <div key={x[0]} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="615" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><kbd data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="616" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{x[0]}</kbd>{x[1]}</div>)}</div></>}
  {settingTab === "Tentang" && <div className="au-about" data-magicpath-id="617" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-about-logo" data-magicpath-id="618" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="layers" size={30} data-magicpath-id="619" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><h2 data-magicpath-id="620" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">sela aurora</h2><p data-magicpath-id="621" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Unified Mail · Interactive Design Prototype</p><p data-magicpath-id="622" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Versi desain 1.0 · Dibangun untuk eksplorasi UI/UX</p><Btn label="Buka panduan" icon="help" onClick={() => setModal("help")} data-magicpath-id="623" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>}
  </div></div></> : null}
  {view === "contacts" ? <><div className="au-page-heading" data-magicpath-id="624" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="625" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="626" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">ADDRESS BOOK</div><h1 data-magicpath-id="627" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kontak</h1><p data-magicpath-id="628" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kenali setiap orang dalam percakapanmu.</p></div><Btn icon="plus" label="Tambah kontak" variant="primary" onClick={() => toastNow("Kontak baru · Fitur contoh antarmuka", "info")} data-magicpath-id="629" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-page-card" data-magicpath-id="630" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-contacts-grid" data-magicpath-id="631" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{PEOPLE.map((p, i) => <div key={p} className="au-contact-card" data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="632" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Avatar name={p} size={47} color={accounts[i % 3].color} data-magicpath-repeat="external" data-magicpath-id="633" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div data-magicpath-repeat="external" data-magicpath-id="634" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="635" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{p}</strong><p data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="636" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{p.toLowerCase().replace(/ /g, ".")}@example.com</p></div><button onClick={() => {
                    setTo(p.toLowerCase().replace(/ /g, ".") + "@example.com");
                    openCompose();
                    setTo(p.toLowerCase().replace(/ /g, ".") + "@example.com");
                  }} title={`Email ${p}`} data-magicpath-repeat="external" data-magicpath-id="637" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="send" size={17} data-magicpath-repeat="external" data-magicpath-id="638" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div>)}</div></div></> : null}
  {view === "labels" ? <><div className="au-page-heading" data-magicpath-id="639" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="640" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="641" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">ORGANISASI</div><h1 data-magicpath-id="642" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Label & folder</h1><p data-magicpath-id="643" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kelompokkan pesan agar selalu mudah ditemukan.</p></div><Btn label="Label baru" icon="plus" variant="primary" onClick={() => {
                setEditLabel(null);
                setNewLabel("");
                setModal("newLabel");
              }} data-magicpath-id="644" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-page-card" data-magicpath-id="645" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{labelList.map((l, i) => <div className="au-field-row" key={l} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="646" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-repeat="external" data-magicpath-id="647" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="648" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-label-square" style={{
                      background: ["#bca6ff", "#7bd9c0", "#f1bb82"][i % 3]
                    }} data-magicpath-repeat="external" data-magicpath-id="649" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> {l}</strong><p data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="650" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{mails.filter(m => m.labels.includes(l)).length} pesan</p></div><Btn icon="eye" title="Lihat pesan" onClick={() => nav(`label:${l}`)} data-magicpath-repeat="external" data-magicpath-id="651" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="edit" title="Ubah label" onClick={() => {
                  setEditLabel(l);
                  setNewLabel(l);
                  setModal("newLabel");
                }} data-magicpath-repeat="external" data-magicpath-id="652" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="trash" title="Hapus label" onClick={() => {
                  setLabelList(xs => xs.filter(s => s !== l));
                  setMails(xs => xs.map(m => ({
                    ...m,
                    labels: m.labels.filter(x => x !== l)
                  })));
                  toastNow("Label dihapus");
                }} data-magicpath-repeat="external" data-magicpath-id="653" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>)}</div></> : null}
  {view === "rules" ? <><div className="au-page-heading" data-magicpath-id="654" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="655" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="656" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">AUTOMASI</div><h1 data-magicpath-id="657" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Aturan inbox</h1><p data-magicpath-id="658" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Buat pengelompokan email otomatis (simulasi).</p></div><Btn icon="plus" label="Aturan baru" variant="primary" onClick={() => setModal("createRule")} data-magicpath-id="659" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-page-card" data-magicpath-id="660" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{rules.map(r => <div key={r.id} className="au-field-row" data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="661" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-repeat="external" data-magicpath-id="662" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="663" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{r.label}</strong><p data-magicpath-repeat="external" data-magicpath-id="664" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Diterapkan saat pesan baru diterima</p></div><label className="au-switch" data-magicpath-repeat="external" data-magicpath-id="665" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={r.enabled} onChange={e => setRules(xs => xs.map(x => x.id === r.id ? {
                    ...x,
                    enabled: e.target.checked
                  } : x))} data-magicpath-repeat="external" data-magicpath-id="666" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-repeat="external" data-magicpath-id="667" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label><Btn icon="trash" title="Hapus aturan" onClick={() => setRules(xs => xs.filter(x => x.id !== r.id))} data-magicpath-repeat="external" data-magicpath-id="668" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>)}</div></> : null}
  {view === "notifications" ? <><div className="au-page-heading" data-magicpath-id="669" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="670" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="671" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">AKTIVITAS</div><h1 data-magicpath-id="672" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Notifikasi</h1><p data-magicpath-id="673" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Semua informasi penting, dalam satu tampilan.</p></div><Btn label="Tandai sudah dibaca" icon="check" onClick={() => {
                setUnreadNotifs(0);
                toastNow("Semua notifikasi sudah dibaca");
              }} data-magicpath-id="674" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-page-card" data-magicpath-id="675" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{[["mail", "Email baru dari Alya Rahman", "Review terakhir sebelum handoff · 10:42"], ["refresh", "Sinkronisasi berhasil", "3 akun tersinkronisasi · 09:54"], ["shield", "Keamanan akun", "Pengingat untuk memeriksa koneksi Outlook"]].map(([ic, t, d], i) => <button key={i} className="au-notif" onClick={() => {
                if (i === 0) {
                  nav("inbox", "all");
                  openMail(1);
                } else if (i === 2) navView("accounts");else refresh();
              }} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="676" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-feature-icon" data-magicpath-repeat="external" data-magicpath-id="677" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={ic as IconName} data-magicpath-repeat="external" data-magicpath-id="678" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></span><span data-magicpath-repeat="external" data-magicpath-id="679" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-repeat="external" data-magicpath-id="680" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{t}</strong><small data-magicpath-repeat="external" data-magicpath-id="681" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{d}</small></span><I n="chevronRight" data-magicpath-repeat="external" data-magicpath-id="682" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>)}</div></> : null}
  {view === "calendar" ? <><div className="au-page-heading" data-magicpath-id="683" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="684" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="685" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">WORKSPACE</div><h1 data-magicpath-id="686" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kalender email</h1><p data-magicpath-id="687" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Gambaran jadwal kirim dan pengingat dari pesanmu.</p></div><Btn icon="calendar" label="Lihat email terjadwal" variant="primary" onClick={() => nav("scheduled")} data-magicpath-id="688" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-page-card au-calendar-card" data-magicpath-id="689" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-calendar-month" data-magicpath-id="690" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="691" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">November 2026</strong><Btn icon="chevronLeft" title="Bulan sebelumnya" onClick={() => toastNow("Navigasi bulan: mode demo", "info")} data-magicpath-id="692" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="chevronRight" title="Bulan berikutnya" onClick={() => toastNow("Navigasi bulan: mode demo", "info")} data-magicpath-id="693" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-calendar-grid" data-magicpath-id="694" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(x => <strong key={x} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="695" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{x}</strong>)}{Array.from({
                  length: 35
                }, (_, i) => <button key={i} className={i + 1 === 5 ? "current" : ""} onClick={() => toastNow(`Tanggal ${i + 1} dipilih · Demo kalender`, "info")} data-magicpath-id="696" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{i < 30 ? i + 1 : ""}</button>)}</div></div></> : null}
  {view === "stateGallery" ? <><div className="au-page-heading" data-magicpath-id="697" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="698" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-heading-eyebrow" data-magicpath-id="699" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">DESIGN SYSTEM / STATES</div><h1 data-magicpath-id="700" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Galeri state antarmuka</h1><p data-magicpath-id="701" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Uji tampilan loading, error, offline, empty dan konfirmasi.</p></div></div><div className="au-states-grid" data-magicpath-id="702" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{[["normal", "Default", "Pesan terlihat normal"], ["loading", "Loading", "Skeleton animated"], ["error", "Error", "Gagal memuat email"], ["offline", "Offline", "Tidak ada koneksi"], ["empty", "Empty", "Hasil pencarian kosong"]].map(([id, name, desc]) => <button className="au-state-card" key={id} onClick={() => {
                setStateDemo(id === "empty" ? "normal" : id);
                nav("inbox");
                if (id === "empty") {
                  setQuery("___no-result___");
                  setSearch("___no-result___");
                }
              }} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="703" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={id === "error" ? "alert" : id === "offline" ? "wifiOff" : id === "loading" ? "refresh" : "mail"} size={21} data-magicpath-repeat="external" data-magicpath-id="704" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><strong data-magicpath-repeat="external" data-magicpath-id="705" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{name}</strong><span data-magicpath-repeat="external" data-magicpath-id="706" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{desc}</span></button>)}</div></> : null}
  </div>}
  <nav className="au-mobile-bottom" data-magicpath-id="707" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button onClick={() => nav("inbox", "all")} className={view === "mail" && !mobileReading ? "active" : ""} data-magicpath-id="708" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="inbox" size={21} data-magicpath-id="709" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="710" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Inbox</span></button><button onClick={() => nav("starred")} data-magicpath-id="711" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="star" size={21} data-magicpath-id="712" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="713" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Bintang</span></button><button className="au-mobile-compose" onClick={() => openCompose()} data-magicpath-id="714" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="plus" size={25} data-magicpath-id="715" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button onClick={() => navView("accounts")} className={view === "accounts" ? "active" : ""} data-magicpath-id="716" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="users" size={21} data-magicpath-id="717" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="718" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Akun</span></button><button onClick={() => navView("settings")} className={view === "settings" ? "active" : ""} data-magicpath-id="719" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="settings" size={21} data-magicpath-id="720" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="721" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Setelan</span></button></nav>
  </div></div>
 {sidebarOpen && <div className="au-sidebar-backdrop" onClick={() => setSidebarOpen(false)} data-magicpath-id="722" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />}
 {compose && <div className={`au-compose-window ${composeFull ? "full" : ""}`} data-magicpath-id="723" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-compose-title" data-magicpath-id="724" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="725" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={composeMode === "reply" ? "reply" : composeMode === "replyAll" ? "replyAll" : composeMode === "forward" ? "forward" : "edit"} size={18} data-magicpath-id="726" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><strong data-magicpath-id="727" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{composeMode === "reply" ? "Balas email" : composeMode === "replyAll" ? "Balas semua" : composeMode === "forward" ? "Teruskan email" : composeMode === "draft" ? "Lanjutkan draf" : "Pesan baru"}</strong><span className="au-compose-status" data-magicpath-id="728" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Draf lokal</span></div><div data-magicpath-id="729" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button title={composeFull ? "Perkecil" : "Perbesar"} onClick={() => setComposeFull(!composeFull)} data-magicpath-id="730" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={composeFull ? "minimize" : "maximize"} data-magicpath-id="731" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button title="Simpan draf dan tutup" onClick={saveDraft} data-magicpath-id="732" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" data-magicpath-id="733" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div></div><div className="au-compose-inner" data-magicpath-id="734" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-compose-line" data-magicpath-id="735" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label data-magicpath-id="736" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Dari</label><select value={sendFrom} onChange={e => setSendFrom(e.target.value)} data-magicpath-id="737" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.map(a => <option key={a.id} value={a.id} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="738" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{a.name} · {a.email}</option>)}</select></div><div className="au-compose-line" data-magicpath-id="739" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label data-magicpath-id="740" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kepada</label><input value={to} onChange={e => setTo(e.target.value)} placeholder="nama@contoh.com" data-magicpath-id="741" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><button onClick={() => setShowCc(!showCc)} data-magicpath-id="742" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{showCc ? "Sembunyikan" : "CC/BCC"}</button></div>{showCc && <><div className="au-compose-line" data-magicpath-id="743" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label data-magicpath-id="744" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">CC</label><input value={cc} onChange={e => setCc(e.target.value)} placeholder="Tembusan" data-magicpath-id="745" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-compose-line" data-magicpath-id="746" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label data-magicpath-id="747" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">BCC</label><input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Tembusan tersembunyi" data-magicpath-id="748" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}<div className="au-compose-line" data-magicpath-id="749" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label data-magicpath-id="750" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Subjek</label><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subjek pesan" data-magicpath-id="751" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><div className="au-editor-toolbar" data-magicpath-id="752" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button onClick={() => setFormatting(s => s.includes("bold") ? s.filter(x => x !== "bold") : [...s, "bold"])} className={formatting.includes("bold") ? "active" : ""} title="Tebal" data-magicpath-id="753" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="bold" data-magicpath-id="754" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button onClick={() => setFormatting(s => s.includes("italic") ? s.filter(x => x !== "italic") : [...s, "italic"])} className={formatting.includes("italic") ? "active" : ""} title="Miring" data-magicpath-id="755" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="italic" data-magicpath-id="756" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button onClick={() => setFormatting(s => s.includes("underline") ? s.filter(x => x !== "underline") : [...s, "underline"])} className={formatting.includes("underline") ? "active" : ""} title="Garis bawah" data-magicpath-id="757" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="underline" data-magicpath-id="758" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button onClick={() => {
            setDraftBody(s => s + " [tautan](https://example.com)");
            bodyRef.current?.focus();
          }} title="Sisipkan tautan" data-magicpath-id="759" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="link" data-magicpath-id="760" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><span className="au-toolbar-divider" data-magicpath-id="761" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><button onClick={() => fileRef.current?.click()} title="Sisipkan gambar" data-magicpath-id="762" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="image" data-magicpath-id="763" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button onClick={() => fileRef.current?.click()} title="Lampirkan file" data-magicpath-id="764" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="paperclip" data-magicpath-id="765" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button onClick={() => {
            setDraftBody(s => s + "\n" + sigText);
            toastNow("Tanda tangan ditambahkan");
          }} title="Sisipkan tanda tangan" data-magicpath-id="766" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="edit" data-magicpath-id="767" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div><textarea ref={bodyRef} value={draftBody} onChange={e => setDraftBody(e.target.value)} style={{
          fontWeight: formatting.includes("bold") ? 700 : 400,
          fontStyle: formatting.includes("italic") ? "italic" : "normal",
          textDecoration: formatting.includes("underline") ? "underline" : "none"
        }} placeholder="Tulis pesan yang berarti..." className="au-compose-body" data-magicpath-id="768" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><input ref={fileRef} type="file" multiple hidden onChange={e => {
          const items = Array.from(e.target.files || []).map(f => f.name);
          setFiles(v => [...v, ...items]);
          toastNow(`${items.length} lampiran ditambahkan (hanya nama file di demo)`);
        }} data-magicpath-id="769" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{files.length > 0 && <div className="au-compose-files" data-magicpath-id="770" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{files.map((f, i) => <span key={f + i} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="771" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="paperclip" size={13} data-magicpath-repeat="external" data-magicpath-id="772" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{f}<button onClick={() => setFiles(xs => xs.filter((_, ix) => ix !== i))} data-magicpath-repeat="external" data-magicpath-id="773" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" size={13} data-magicpath-repeat="external" data-magicpath-id="774" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></span>)}</div>}</div><div className="au-compose-bottom" data-magicpath-id="775" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label={loading ? "Mengirim..." : "Kirim"} icon="send" variant="primary" disabled={loading} onClick={() => sendMessage()} data-magicpath-id="776" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><button className="au-send-dropdown" title="Jadwalkan kirim" onClick={() => setModal("schedule")} data-magicpath-id="777" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="chevronDown" size={15} data-magicpath-id="778" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><Btn icon="calendar" title="Jadwalkan pengiriman" onClick={() => setModal("schedule")} data-magicpath-id="779" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="file" title="Simpan draf" onClick={saveDraft} data-magicpath-id="780" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-spacer" data-magicpath-id="781" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="trash" title="Buang draf" onClick={() => {
          if (to || subject || draftBody || files.length) {
            setMenu("discard");
          } else {
            setCompose(false);
            resetComposer();
          }
        }} data-magicpath-id="782" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>{menu === "discard" && <div className="au-discard-note" data-magicpath-id="783" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="784" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Buang pesan yang belum tersimpan?</strong><div data-magicpath-id="785" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setMenu(null)} data-magicpath-id="786" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn label="Buang" variant="danger" onClick={() => {
            setMenu(null);
            setCompose(false);
            resetComposer();
            toastNow("Draf dibuang");
          }} data-magicpath-id="787" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></div>}</div>}
 {modal !== "none" && <div className="au-modal-backdrop" role="presentation" onMouseDown={e => {
      if (e.target === e.currentTarget) setModal("none");
    }} data-magicpath-id="788" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className={`au-modal ${modal === "attachments" ? "au-modal-gallery" : ""}`} role="dialog" aria-modal="true" data-magicpath-id="789" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-modal-header" data-magicpath-id="790" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-modal-title" data-magicpath-id="791" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-modal-icon" data-magicpath-id="792" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={modal === "addAccount" || modal === "connectStep" || modal === "accountSuccess" ? "users" : modal === "snooze" || modal === "schedule" ? "clock" : modal === "permanent" || modal === "emptyTrash" || modal === "disconnect" ? "alert" : modal === "attachments" ? "image" : modal === "help" ? "help" : "settings"} size={20} data-magicpath-id="793" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></span><strong data-magicpath-id="794" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{({
                addAccount: "Hubungkan akun email",
                connectStep: `Hubungkan ${provider}`,
                accountSuccess: "Akun terhubung!",
                disconnect: "Lepaskan akun?",
                schedule: "Jadwalkan pengiriman",
                snooze: "Tunda email",
                move: "Pindahkan email",
                labels: "Terapkan label",
                newLabel: editLabel ? "Ubah label" : "Buat label baru",
                permanent: "Hapus secara permanen?",
                emptyTrash: "Kosongkan sampah?",
                attachments: "Pratinjau lampiran",
                sender: "Detail pengirim",
                shortcuts: "Pintasan keyboard",
                createRule: "Aturan email baru",
                print: "Pratinjau cetak",
                reconnect: "Hubungkan akun kembali",
                offline: "Status koneksi",
                help: "Bantuan & panduan"
              } as Record<Modal, string>)[modal]}</strong></div><button onClick={() => setModal("none")} title="Tutup dialog" data-magicpath-id="795" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" data-magicpath-id="796" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div><div className="au-modal-content" data-magicpath-id="797" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">
 {modal === "addAccount" && <><p data-magicpath-id="798" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tambahkan Gmail atau Outlook. Setiap akun tetap terhubung tanpa harus keluar dari akun lain.</p><div className="au-provider-options" data-magicpath-id="799" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button onClick={() => startConnect("Gmail")} data-magicpath-id="800" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-provider-lg google" data-magicpath-id="801" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">G</span><span data-magicpath-id="802" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="803" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Lanjutkan dengan Google</strong><small data-magicpath-id="804" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Gmail pribadi atau Google Workspace</small></span><I n="arrowRight" data-magicpath-id="805" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button onClick={() => startConnect("Outlook")} data-magicpath-id="806" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-provider-lg microsoft" data-magicpath-id="807" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">M</span><span data-magicpath-id="808" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="809" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Lanjutkan dengan Microsoft</strong><small data-magicpath-id="810" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Outlook atau Microsoft 365</small></span><I n="arrowRight" data-magicpath-id="811" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div><div className="au-modal-hint" data-magicpath-id="812" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="shield" size={16} data-magicpath-id="813" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /> Ini hanya desain prototipe. Tidak ada autentikasi OAuth sungguhan.</div></>}
 {modal === "connectStep" && <><div className="au-step-indicator" data-magicpath-id="814" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="active" data-magicpath-id="815" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">1. Pilih akun</span><span data-magicpath-id="816" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">2. Izin akses</span><span data-magicpath-id="817" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">3. Selesai</span></div><p data-magicpath-id="818" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Simulasikan tampilan sambungan ke <strong data-magicpath-id="819" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{provider}</strong>. Masukkan alamat email contoh untuk ditampilkan di akun.</p><label className="au-modal-label" data-magicpath-id="820" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Alamat email<input type="email" placeholder={provider === "Gmail" ? "nama@gmail.com" : "nama@outlook.com"} value={oauthEmail} onChange={e => setOauthEmail(e.target.value)} data-magicpath-id="821" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label><div className="au-oauth-card" data-magicpath-id="822" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="shield" data-magicpath-id="823" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div data-magicpath-id="824" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="825" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Izin akses yang diperlukan</strong><p data-magicpath-id="826" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Membaca pesan, mengirim email, dan mengelola folder. Tidak ada data nyata yang diakses dalam prototype.</p></div></div><div className="au-modal-actions" data-magicpath-id="827" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Kembali" onClick={() => setModal("addAccount")} data-magicpath-id="828" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="check" label="Setujui & hubungkan (demo)" variant="primary" onClick={completeConnect} data-magicpath-id="829" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "accountSuccess" && <div className="au-success-block" data-magicpath-id="830" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div className="au-success-icon" data-magicpath-id="831" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="checkCircle" size={43} data-magicpath-id="832" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div><h3 data-magicpath-id="833" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Akun contoh berhasil ditambahkan</h3><p data-magicpath-id="834" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{oauthEmail} sekarang muncul di daftar akun. Semua email tetap berupa data simulasi.</p><Btn label="Lihat akun" icon="users" variant="primary" onClick={() => {
              setModal("none");
              navView("accounts");
            }} data-magicpath-id="835" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div>}
 {modal === "disconnect" && <><p data-magicpath-id="836" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Akun <strong data-magicpath-id="837" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.find(a => a.id === selectedAcc)?.email}</strong> akan dilepas dari daftar prototipe. Email fiktif lainnya tidak terpengaruh.</p><div className="au-modal-actions" data-magicpath-id="838" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setModal("none")} data-magicpath-id="839" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn label="Lepaskan akun" icon="trash" variant="danger" onClick={confirmDisconnect} data-magicpath-id="840" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "schedule" && <><p data-magicpath-id="841" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pilih waktu pengiriman email contoh.</p><div className="au-form-grid" data-magicpath-id="842" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label className="au-modal-label" data-magicpath-id="843" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tanggal<input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} data-magicpath-id="844" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label><label className="au-modal-label" data-magicpath-id="845" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Waktu<input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)} data-magicpath-id="846" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><div className="au-modal-actions" data-magicpath-id="847" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setModal("none")} data-magicpath-id="848" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="calendar" label="Jadwalkan" variant="primary" onClick={() => sendMessage(true)} data-magicpath-id="849" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "snooze" && <><p data-magicpath-id="850" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Email akan disembunyikan dari inbox sampai tanggal yang dipilih (simulasi).</p><div className="au-form-grid" data-magicpath-id="851" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><label className="au-modal-label" data-magicpath-id="852" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tanggal<input type="date" value={dateVal} onChange={e => setDateVal(e.target.value)} data-magicpath-id="853" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label><label className="au-modal-label" data-magicpath-id="854" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Waktu<input type="time" value={timeVal} onChange={e => setTimeVal(e.target.value)} data-magicpath-id="855" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label></div><div className="au-modal-actions" data-magicpath-id="856" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setModal("none")} data-magicpath-id="857" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn label="Tunda email" icon="clock" variant="primary" onClick={() => {
                updateMail(actIDs, {
                  folder: "snoozed"
                }, `Email ditunda hingga ${dateVal} ${timeVal}`);
                setModal("none");
                setSelectedMail(null);
                setMobileReading(false);
              }} data-magicpath-id="858" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "move" && <><p data-magicpath-id="859" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pilih folder tujuan untuk pesan yang dipilih.</p><div className="au-option-list" data-magicpath-id="860" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{FOLDERS.filter(f => ["inbox", "archive", "spam", "trash", "drafts"].includes(f.id)).map(f => <button key={f.id} onClick={() => {
                updateMail(actIDs, {
                  folder: f.id
                }, `Email dipindahkan ke ${f.label}`);
                setModal("none");
                setSelectedMail(null);
                setMobileReading(false);
              }} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="861" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={f.icon} data-magicpath-repeat="external" data-magicpath-id="862" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{f.label}<I n="chevronRight" size={15} data-magicpath-repeat="external" data-magicpath-id="863" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>)}</div></>}
 {modal === "labels" && <><p data-magicpath-id="864" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Terapkan atau lepaskan label pada pesan terpilih.</p><div className="au-option-list" data-magicpath-id="865" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{labelList.map(l => <label key={l} className="au-label-option" data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="866" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><input type="checkbox" checked={!!selected?.labels.includes(l)} onChange={e => {
                  const next = e.target.checked ? [...(selected?.labels || []), l] : (selected?.labels || []).filter(x => x !== l);
                  updateMail(actIDs, {
                    labels: next
                  });
                  toastNow(e.target.checked ? `Label ${l} ditambahkan` : `Label ${l} dilepas`);
                }} data-magicpath-repeat="external" data-magicpath-id="867" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><I n="tag" data-magicpath-repeat="external" data-magicpath-id="868" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" />{l}</label>)}</div><Btn icon="plus" label="Buat label baru" onClick={() => {
              setNewLabel("");
              setEditLabel(null);
              setModal("newLabel");
            }} data-magicpath-id="869" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-modal-actions" data-magicpath-id="870" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Selesai" variant="primary" onClick={() => setModal("none")} data-magicpath-id="871" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "newLabel" && <><p data-magicpath-id="872" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Nama label akan muncul di navigasi dan dapat dipakai untuk mengelompokkan pesan.</p><label className="au-modal-label" data-magicpath-id="873" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Nama label<input value={newLabel} placeholder="Misalnya: Portofolio" onChange={e => setNewLabel(e.target.value)} data-magicpath-id="874" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label><div className="au-modal-actions" data-magicpath-id="875" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setModal("none")} data-magicpath-id="876" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="check" label="Simpan label" variant="primary" onClick={() => {
                const val = newLabel.trim();
                if (!val) {
                  toastNow("Nama label tidak boleh kosong", "warning");
                  return;
                }
                if (labelList.includes(val) && editLabel !== val) {
                  toastNow("Label sudah ada", "warning");
                  return;
                }
                setLabelList(xs => editLabel ? xs.map(x => x === editLabel ? val : x) : [...xs, val]);
                if (editLabel) setMails(xs => xs.map(m => ({
                  ...m,
                  labels: m.labels.map(x => x === editLabel ? val : x)
                })));
                setModal("none");
                toastNow(editLabel ? "Label diperbarui" : "Label dibuat");
              }} data-magicpath-id="877" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "permanent" || modal === "emptyTrash" ? <><div className="au-danger-banner" data-magicpath-id="878" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="alert" data-magicpath-id="879" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="880" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tindakan ini tidak dapat dibatalkan dalam prototipe.</span></div><p data-magicpath-id="881" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{modal === "emptyTrash" ? "Semua pesan di Sampah akan dihapus dari data contoh." : "Pesan akan dihapus permanen dari data contoh."}</p><div className="au-modal-actions" data-magicpath-id="882" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setModal("none")} data-magicpath-id="883" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="trash" label="Hapus permanen" variant="danger" onClick={() => {
                setMails(xs => xs.filter(m => !(modal === "emptyTrash" ? m.folder === "trash" : actIDs.includes(m.id))));
                setSelectedMail(null);
                setMobileReading(false);
                setModal("none");
                toastNow("Pesan contoh dihapus permanen");
              }} data-magicpath-id="884" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></> : null}
 {modal === "attachments" && <><div className="au-gallery-display" data-magicpath-id="885" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><img src={[PHOTO.workspace, PHOTO.travel, PHOTO.interior, PHOTO.coffee][activeImage % 4]} alt="Pratinjau foto contoh" data-magicpath-id="886" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div className="au-gallery-arrow" data-magicpath-id="887" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button title="Foto sebelumnya" onClick={() => setActiveImage(i => (i + 3) % 4)} data-magicpath-id="888" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="chevronLeft" data-magicpath-id="889" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button><button title="Foto berikutnya" onClick={() => setActiveImage(i => (i + 1) % 4)} data-magicpath-id="890" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="chevronRight" data-magicpath-id="891" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div></div><div className="au-gallery-thumbs" data-magicpath-id="892" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{[PHOTO.workspace, PHOTO.travel, PHOTO.interior, PHOTO.coffee].map((p, i) => <button key={i} className={i === activeImage ? "active" : ""} onClick={() => setActiveImage(i)} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-id="893" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><img src={p} alt={`Thumbnail contoh ${i + 1}`} data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="894" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button>)}</div><div className="au-modal-actions" data-magicpath-id="895" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><span className="au-modal-muted" data-magicpath-id="896" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Galeri demo • {activeImage + 1} / 4</span><Btn icon="download" label="Unduh contoh" onClick={() => toastNow("Ini adalah pratinjau — tidak ada file asli untuk diunduh", "info")} data-magicpath-id="897" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "sender" && selected && <><div className="au-sender-profile" data-magicpath-id="898" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Avatar name={selected.from} size={65} data-magicpath-id="899" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><h3 data-magicpath-id="900" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.from}</h3><p data-magicpath-id="901" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.address}</p></div><div className="au-detail-list" data-magicpath-id="902" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="903" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Dari <strong data-magicpath-id="904" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.address}</strong></div><div data-magicpath-id="905" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kepada <strong data-magicpath-id="906" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{accounts.find(a => a.id === selected.accountId)?.email}</strong></div><div data-magicpath-id="907" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Kategori <strong data-magicpath-id="908" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.category}</strong></div><div data-magicpath-id="909" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Waktu <strong data-magicpath-id="910" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.date} · {selected.time}</strong></div></div><div className="au-modal-actions" data-magicpath-id="911" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn icon="copy" label="Salin email" onClick={() => {
                navigator.clipboard?.writeText(selected.address);
                toastNow("Alamat disalin");
              }} data-magicpath-id="912" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn label="Balas" icon="reply" variant="primary" onClick={() => openCompose("reply", selected)} data-magicpath-id="913" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "shortcuts" && <div className="au-shortcut-grid" data-magicpath-id="914" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{[["C", "Tulis email"], ["/", "Pencarian"], ["S", "Bintang"], ["A", "Arsip"], ["Esc", "Tutup dialog"]].map(x => <div key={x[0]} data-magicpath-repeat="external" data-magicpath-repeat-root="true" data-magicpath-binding="external" data-magicpath-id="915" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><kbd data-magicpath-repeat="external" data-magicpath-binding="external" data-magicpath-id="916" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{x[0]}</kbd>{x[1]}</div>)}</div>}
 {modal === "createRule" && <><p data-magicpath-id="917" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Buat aturan inbox berbasis pengirim.</p><label className="au-modal-label" data-magicpath-id="918" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pengirim mengandung<input value={ruleFrom} onChange={e => setRuleFrom(e.target.value)} placeholder="newsletter@example.com" data-magicpath-id="919" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></label><label className="au-modal-label" data-magicpath-id="920" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tindakan<select value={ruleAction} onChange={e => setRuleAction(e.target.value)} data-magicpath-id="921" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><option value="label" data-magicpath-id="922" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tambahkan label</option><option value="archive" data-magicpath-id="923" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Arsipkan</option><option value="star" data-magicpath-id="924" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Beri bintang</option></select></label><div className="au-modal-actions" data-magicpath-id="925" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setModal("none")} data-magicpath-id="926" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn label="Buat aturan" variant="primary" onClick={() => {
                if (!ruleFrom.trim()) {
                  toastNow("Masukkan pengirim dulu", "warning");
                  return;
                }
                setRules(rs => [...rs, {
                  id: Date.now(),
                  label: `${ruleFrom} → ${ruleAction}`,
                  enabled: true
                }]);
                setRuleFrom("");
                setModal("none");
                toastNow("Aturan demo dibuat");
              }} data-magicpath-id="927" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "print" && selected && <><div className="au-print-preview" data-magicpath-id="928" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><h3 data-magicpath-id="929" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.subject}</h3><small data-magicpath-id="930" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.from} • {selected.address}</small><p data-magicpath-id="931" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{selected.body}</p></div><div className="au-modal-actions" data-magicpath-id="932" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Tutup" onClick={() => setModal("none")} data-magicpath-id="933" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn icon="printer" label="Cetak (browser)" variant="primary" onClick={() => {
                setModal("none");
                toastNow("Pratinjau cetak disiapkan · gunakan Ctrl+P di browser", "info");
              }} data-magicpath-id="934" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "reconnect" && <><div className="au-oauth-card" data-magicpath-id="935" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="lock" size={25} data-magicpath-id="936" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><div data-magicpath-id="937" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="938" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Perizinan perlu diperbarui</strong><p data-magicpath-id="939" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Simulasi akun: {accounts.find(a => a.id === selectedAcc)?.email}</p></div></div><p data-magicpath-id="940" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Hubungkan ulang akun untuk memulihkan status sinkronisasi.</p><div className="au-modal-actions" data-magicpath-id="941" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><Btn label="Batal" onClick={() => setModal("none")} data-magicpath-id="942" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><Btn label="Hubungkan ulang (demo)" variant="primary" icon="refresh" onClick={() => {
                setAccounts(xs => xs.map(a => a.id === selectedAcc ? {
                  ...a,
                  online: true
                } : a));
                setModal("none");
                toastNow("Koneksi akun berhasil dipulihkan");
              }} data-magicpath-id="943" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></div></>}
 {modal === "help" && <><div className="au-help-stack" data-magicpath-id="944" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><div data-magicpath-id="945" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="946" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Mulai dari mana?</strong><p data-magicpath-id="947" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Pilih inbox, buka salah satu pesan, lalu gunakan toolbar untuk mengarsipkan, membalas, atau memberi label.</p></div><div data-magicpath-id="948" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="949" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Tulis pesan baru</strong><p data-magicpath-id="950" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Klik tombol ungu "Tulis email". Pengiriman dan OAuth hanya simulasi dalam prototipe.</p></div><div data-magicpath-id="951" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><strong data-magicpath-id="952" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Galeri state</strong><p data-magicpath-id="953" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Buka menu Sistem & state untuk mencoba tampilan loading, error, offline, dan kosong.</p></div></div><Btn label="Tutup panduan" variant="primary" onClick={() => setModal("none")} data-magicpath-id="954" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></>}
 </div></div></div>}
 {toast && <div className={`au-toast au-toast-${toast.type}`} data-magicpath-id="955" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n={toast.type === "warning" ? "alert" : toast.type === "info" ? "info" : "checkCircle"} size={18} data-magicpath-id="956" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="957" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">{toast.message}</span>{toast.undo && <button onClick={() => {
        toast.undo?.();
        setToast(null);
      }} data-magicpath-id="958" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Urungkan</button>}<button title="Tutup notifikasi" onClick={() => setToast(null)} data-magicpath-id="959" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="x" size={15} data-magicpath-id="960" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /></button></div>}
 <div className="au-demo-mark" title="UI prototype only" data-magicpath-id="961" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">PROTOTYPE • DATA DEMO</div>
 <div className="au-hidden-entry" data-magicpath-id="962" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><button onClick={() => navView("labels")} data-magicpath-id="963" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Label</button><button onClick={() => navView("rules")} data-magicpath-id="964" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Aturan</button><button onClick={() => navView("stateGallery")} data-magicpath-id="965" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">States</button></div>
 <button className="au-command-palette-launch" onClick={() => navView("stateGallery")} title="Galeri state desain" data-magicpath-id="966" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="sparkles" size={15} data-magicpath-id="967" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="968" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">UI States</span></button>
 <button className="au-rules-launch" onClick={() => navView("rules")} title="Kelola aturan inbox" data-magicpath-id="969" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="filter" size={15} data-magicpath-id="970" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="971" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Aturan</span></button>
 <button className="au-labels-launch" onClick={() => navView("labels")} title="Kelola label" data-magicpath-id="972" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx"><I n="tag" size={15} data-magicpath-id="973" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx" /><span data-magicpath-id="974" data-magicpath-path="AuroraFullyInteractiveEmailClient.tsx">Label</span></button>
 </div>;
};
export default AuroraFullyInteractiveEmailClient;