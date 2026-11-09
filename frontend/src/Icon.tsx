import React from 'react';

// ponytail: reuse Aurora's local SVG vocabulary; switch to lucide-react when package installation is authorized.
const paths = {
  Inbox: <><path d="M4 4h16l2 10v6H2v-6L4 4Z" /><path d="M2 14h6l2 3h4l2-3h6" /></>,
  Star: <path d="m12 2 3.1 6.3 7 .9-5.1 5 1.2 7-6.2-3.3-6.2 3.3 1.2-7-5.1-5 7-.9L12 2Z" />,
  Flag: <path d="M5 22V4m0 1c6-4 8 3 15-1v12c-7 4-9-3-15 1" />,
  Send: <><path d="M22 2 11 13" /><path d="m22 2-7 20-4-9-9-4 20-7Z" /></>,
  FilePenLine: <><path d="M12 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10M14 3v5h5M9 17h3l9-9-3-3-9 9v3Z" /></>,
  Archive: <><rect x="3" y="4" width="18" height="5" rx="1" /><path d="M5 9v11h14V9m-9 4h4" /></>,
  ShieldAlert: <><path d="m12 2-8 3v6c0 6 4.4 9 8 11 3.6-2 8-5 8-11V5l-8-3Z" /><path d="M12 7v6m0 4h.01" /></>,
  Trash2: <path d="M3 6h18m-14 0 1 15h8l1-15M9 6V4h6v2m-5 4v7m4-7v7" />,
  Mails: <><rect x="6" y="3" width="16" height="13" rx="2" /><path d="m6 5 8 6 8-6M2 8v11a2 2 0 0 0 2 2h14" /></>,
  SquarePen: <><path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M9 15l1-4 9-9 3 3-9 9-4 1Z" /></>,
  Search: <><circle cx="11" cy="11" r="7" /><path d="m16 16 5 5" /></>,
  Settings2: <><path d="M4 7h9m4 0h3M4 17h3m4 0h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
  RefreshCw: <path d="M20 7a8 8 0 0 0-14-2L3 8m0-5v5h5M4 17a8 8 0 0 0 14 2l3-3m0 5v-5h-5" />,
  Mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  Tag: <><path d="M3 4h10l8 8-9 9-9-9V4Z" /><circle cx="8" cy="9" r="1" /></>,
  Users: <><circle cx="9" cy="8" r="3" /><path d="M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6m0 3c3 0 5 2 5 5" /></>,
  UsersRound: <><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M17 4a4 4 0 0 1 0 8m1 3a6 6 0 0 1 4 6" /></>,
  Bell: <path d="M6 9a6 6 0 0 1 12 0v5l2 3H4l2-3V9Zm4 11h4" />,
  Plus: <path d="M12 5v14M5 12h14" />,
  Minus: <path d="M5 12h14" />,
  Maximize: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
  Minimize: <path d="M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5" />,
  Paperclip: <path d="m21 11-9 9a6 6 0 0 1-8-8L14 2a4 4 0 0 1 6 6L10 18a2 2 0 0 1-3-3l9-9" />,
  File: <><path d="M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 13h8m-8 4h5" /></>,
  Reply: <path d="m9 10-5 5 5 5M4 15h10a6 6 0 0 1 6 6V11a6 6 0 0 0-6-6" />,
  ReplyAll: <><path d="m7 7-5 5 5 5m6-10-5 5 5 5M8 12h8a5 5 0 0 1 5 5v3" /></>,
  Forward: <path d="m15 5 5 5-5 5m5-5H9a5 5 0 0 0-5 5v5" />,
  Menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  X: <path d="M5 5 19 19M19 5 5 19" />,
  ChevronLeft: <path d="m15 18-6-6 6-6" />,
  Undo2: <path d="m8 7-5 5 5 5M3 12h11a6 6 0 0 1 6 6" />,
  Check: <path d="m4 12 5 5L20 6" />,
  ExternalLink: <><path d="M13 4h7v7m0-7-9 9M20 14v6H4V4h6" /></>,
} satisfies Record<string, React.ReactNode>;

export function Icon({ name, size = 18, filled = false }: { name: keyof typeof paths; size?: number; filled?: boolean }) {
  return <svg className="au-icon" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
