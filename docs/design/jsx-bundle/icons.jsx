// Minimal stroked icons — geometric, swiss
const Icon = ({ d, size = 16, stroke = 1.7, fill, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || "none"} stroke="currentColor" strokeWidth={stroke} strokeLinecap="square" strokeLinejoin="miter" {...rest}>
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);
const IconSearch = (p) => <Icon {...p} d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />;
const IconPlus = (p) => <Icon {...p} d="M12 5v14M5 12h14" />;
const IconCheck = (p) => <Icon {...p} d="M5 12.5l4.5 4.5L19 7" />;
const IconX = (p) => <Icon {...p} d="M6 6l12 12M18 6L6 18" />;
const IconCalendar = (p) => <Icon {...p} d={<><rect x="3" y="5" width="18" height="16" /><path d="M3 10h18M8 3v4M16 3v4" /></>} />;
const IconClock = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>} />;
const IconFlag = (p) => <Icon {...p} d="M5 21V4M5 4h14l-3 4 3 4H5" />;
const IconUser = (p) => <Icon {...p} d={<><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></>} />;
const IconInbox = (p) => <Icon {...p} d={<><path d="M3 13l2-7h14l2 7" /><path d="M3 13v6h18v-6h-6l-2 3h-4l-2-3H3z" /></>} />;
const IconStar = (p) => <Icon {...p} d="M12 3l2.7 5.7 6.3.9-4.6 4.4 1.1 6.3L12 17.6l-5.5 2.7 1.1-6.3L3 9.6l6.3-.9L12 3z" />;
const IconSettings = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="3" /><path d="M19 15l1 1-2 3-2-1M5 9L4 8l2-3 2 1M9 5l-1-1 3-2 1 2M15 19l1 1 3-2-1-2M19 9l1-1-2-3-2 1M5 15l-1 1 2 3 2-1M9 19l-1 1 3 2 1-2M15 5l1-1-3-2-1 2" /></>} />;
const IconSpark = (p) => <Icon {...p} d="M12 3v6M12 15v6M3 12h6M15 12h6" />;
const IconMoon = (p) => <Icon {...p} d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />;
const IconSun = (p) => <Icon {...p} d={<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>} />;
const IconMore = (p) => <Icon {...p} d={<><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></>} />;
const IconFilter = (p) => <Icon {...p} d="M3 5h18l-7 9v6l-4-2v-4L3 5z" />;
const IconList = (p) => <Icon {...p} d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />;
const IconBoard = (p) => <Icon {...p} d={<><rect x="3" y="3" width="7" height="18" /><rect x="14" y="3" width="7" height="11" /></>} />;
const IconHome = (p) => <Icon {...p} d="M3 11l9-8 9 8v9h-6v-7H9v7H3v-9z" />;
const IconArrow = (p) => <Icon {...p} d="M5 12h14M13 6l6 6-6 6" />;
const IconGrid = (p) => <Icon {...p} d={<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>} />;

Object.assign(window, {
  Icon, IconSearch, IconPlus, IconCheck, IconX, IconCalendar, IconClock, IconFlag,
  IconUser, IconInbox, IconStar, IconSettings, IconSpark, IconMoon, IconSun,
  IconMore, IconFilter, IconList, IconBoard, IconHome, IconArrow, IconGrid,
});
