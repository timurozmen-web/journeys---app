// Icons ported directly from the prototype's SVG paths — same visual
// language (1.7 stroke, round caps), now as typed React components.
import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}

const wrap = (path: string) => ({ size = 21, color = 'currentColor', style, strokeWidth = 1.7 }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    dangerouslySetInnerHTML={{ __html: path }}
  />
);

export const PlusIcon = wrap('<path d="M12 5v14M5 12h14"/>');
export const SettingsIcon = wrap(
  '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
);

// Filled variants -- bolder, solid silhouettes for the bottom tab bar,
// matching a more app-native look than the thin-stroke set above.
const wrapFilled = (path: string) => ({ size = 22, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    stroke="none"
    style={style}
    dangerouslySetInnerHTML={{ __html: path }}
  />
);

export const CreditIcon = wrap(
  '<path d="M2.5 8.5 12 3l9.5 5.5-9.5 5.5-9.5-5.5Z"/><path d="M6 11v5.5c0 1.4 2.7 3 6 3s6-1.6 6-3V11"/>'
);
export const ThermometerIcon = wrap(
  '<path d="M14 14.76V3.5a2 2 0 0 0-4 0v11.26a4 4 0 1 0 4 0z"/><path d="M11 8h1"/>'
);
export const DropletIcon = wrap(
  '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>'
);
export const CloudRainIcon = wrap(
  '<path d="M6.5 18a4 4 0 1 1 .9-7.9 5 5 0 0 1 9.6-1.6A4.5 4.5 0 0 1 17.5 17H7z"/><path d="M9 19v1"/><path d="M12 19v2"/><path d="M15 19v1"/>'
);
export const UsersIcon = wrap(
  '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
);
export const TagIcon = wrap(
  '<path d="M20.6 12.6 12.4 20.8a2 2 0 0 1-2.83 0l-7.4-7.4a2 2 0 0 1 0-2.83L9.4 2.4A2 2 0 0 1 10.8 1.8H19a2 2 0 0 1 2 2v8.2a2 2 0 0 1-.4 1.6z"/><circle cx="15" cy="7" r="1.5"/>'
);
export const AlertIcon = wrap(
  '<circle cx="12" cy="12" r="9"/><path d="M12 7.8v5.6"/><path d="M12 16.6v.01"/>'
);
export const StarIcon = wrap(
  '<path d="M12 2.8 14.9 9l6.8.6-5.2 4.5 1.6 6.7-6.1-3.7-6.1 3.7 1.6-6.7-5.2-4.5L11.1 9z"/>'
);
export const BedIcon = wrap(
  '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M7 10V7h10v3"/>'
);
export const PlaneIcon = wrap(
  '<path d="M2 12h6l4-7 2 1-2 6h5l2-3h2l-1.5 4L21 16h-2l-2-3h-5l2 6-2 1-4-7H2z"/>'
);
export const TrainIcon = wrap(
  '<rect x="5" y="3" width="14" height="14" rx="4"/><path d="M5 13h14M9 17l-2 4M15 17l2 4"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/>'
);
export const CarIcon = wrap(
  '<path d="M4 16V11l2-5h12l2 5v5"/><path d="M4 16h16M6 16v2M18 16v2"/><circle cx="7.5" cy="16" r="1.5"/><circle cx="16.5" cy="16" r="1.5"/>'
);
export const BackIcon = wrap('<path d="M15 5 8 12l7 7"/>');
export const CalendarIcon = wrap('<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>');
export const MailIcon = wrap(
  '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 6.5 12 13l8.5-6.5"/>'
);
export const CameraIcon = wrap(
  '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'
);
export const PinIcon = wrap(
  '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/>'
);
export const CheckIcon = wrap('<path d="M4 12.5 9.5 18 20 6"/>');
export const XIcon = wrap('<path d="M5 5l14 14M19 5 5 19"/>');
export const EditIcon = wrap('<path d="M17 3a2.85 2.65 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>');
export const GripIcon = wrap(
  '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>'
);
export const ExternalLinkIcon = wrap(
  '<path d="M14 4h6v6M20 4 11 13M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>'
);

// A filled crescent: one per night on a stay's itinerary card.
export const MoonIcon = wrapFilled('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>');

// One-app tab bar and capture sheet.
export const TodayIcon = wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>');
export const SuitcaseIcon = wrap('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>');
export const StatusIcon = wrap('<circle cx="12" cy="12" r="8" opacity=".45"/><path d="M12 4a8 8 0 1 1-7.6 5.5"/>');
export const CardIcon = wrap('<rect x="2.5" y="5.5" width="19" height="13" rx="2"/><path d="M2.5 10h19M6 15h4"/>');
export const ImageIcon = wrap('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>');
export const GlobeIcon = wrap('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>');
export const ChevronRightIcon = wrap('<path d="M9 6l6 6-6 6"/>');
