// Icons ported directly from the prototype's SVG paths — same visual
// language (1.7 stroke, round caps), now as typed React components.
import type { CSSProperties } from 'react';

interface IconProps {
  size?: number;
  color?: string;
  style?: CSSProperties;
}

const wrap = (path: string) => ({ size = 21, color = 'currentColor', style }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={style}
    dangerouslySetInnerHTML={{ __html: path }}
  />
);

export const HomeIcon = wrap(
  '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/><path d="M9.5 21v-3.2h1.4"/>'
);
export const TripsIcon = wrap(
  '<rect x="3" y="5.5" width="18" height="13" rx="3"/><path d="M9.5 5.5v13M14.5 5.5v13" stroke-dasharray="1.6 2.2"/>'
);
export const WalletIcon = wrap(
  '<rect x="2.5" y="5.5" width="19" height="13" rx="3.2"/><path d="M2.5 10h19"/>'
);
export const ProfileIcon = wrap(
  '<circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/><circle cx="12" cy="12" r="10" opacity=".35"/>'
);
export const PlanIcon = wrap(
  '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2 13 13l-3.8 1.8L11 11z"/>'
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

export const HomeIconFilled = wrapFilled(
  '<path d="M12 2.9a1 1 0 0 1 .64.23l8.5 7.1a1 1 0 0 1-1.28 1.54l-.36-.3V19.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2v-8.03l-.36.3a1 1 0 0 1-1.28-1.54l8.5-7.1A1 1 0 0 1 12 2.9z"/><rect class="home-door" x="9.6" y="15.4" width="3.3" height="6.1" rx="1.2" fill="var(--card)"/>'
);

export const TripsIconFilled = wrapFilled(
  '<path d="M6 3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1h4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5h.5A2.5 2.5 0 0 1 21 7v11.5A2.5 2.5 0 0 1 18.5 21h-13A2.5 2.5 0 0 1 3 18.5V7a2.5 2.5 0 0 1 2.5-2.5H6z"/><path class="trips-pages" d="M5 10.5h14v1.6H5zM5 15h14v1.6H5z" fill="var(--card)" opacity=".85"/>'
);

export const WalletIconFilled = wrapFilled(
  '<path d="M2.5 10.5h19V16A3.2 3.2 0 0 1 18.3 19.2H5.7A3.2 3.2 0 0 1 2.5 16z"/><circle cx="17" cy="14.5" r="1.6" fill="var(--card)"/><path class="wallet-flap" d="M2.5 8.7A3.2 3.2 0 0 1 5.7 5.5h11.6a3.2 3.2 0 0 1 3.2 3.2v.3H2.5z"/>'
);

export const ProfileIconFilled = wrapFilled(
  '<path d="M4.2 20.2a7.8 7.8 0 0 1 15.6 0 1 1 0 0 1-1 1.05H5.2a1 1 0 0 1-1-1.05z"/><circle class="profile-head" cx="12" cy="8.2" r="3.9"/>'
);
export const CaptureIcon = wrap(
  '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>'
);
export const DiscoverIcon = wrap(
  '<path d="M12 3.5 13.9 9l5.6.3-4.4 3.5 1.5 5.4L12 15.2 7.4 18.2l1.5-5.4L4.5 9.3 10.1 9z"/>'
);
export const CreditIcon = wrap(
  '<path d="M2.5 8.5 12 3l9.5 5.5-9.5 5.5-9.5-5.5Z"/><path d="M6 11v5.5c0 1.4 2.7 3 6 3s6-1.6 6-3V11"/>'
);
export const BedIcon = wrap(
  '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18h18M7 10V7h10v3"/>'
);
export const HotelIcon = wrap(
  '<path d="M3 21h18M5 21V8l7-5 7 5v13M10 21v-5h4v5"/>'
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
export const CameraIcon = wrap(
  '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>'
);
export const PinIcon = wrap(
  '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.4"/>'
);
export const ChevronDownIcon = wrap('<path d="m6 9 6 6 6-6"/>');
export const EditIcon = wrap('<path d="M17 3a2.85 2.65 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>');
export const GripIcon = wrap(
  '<circle cx="9" cy="6" r="1.3"/><circle cx="15" cy="6" r="1.3"/><circle cx="9" cy="12" r="1.3"/><circle cx="15" cy="12" r="1.3"/><circle cx="9" cy="18" r="1.3"/><circle cx="15" cy="18" r="1.3"/>'
);
export const ExternalLinkIcon = wrap(
  '<path d="M14 4h6v6M20 4 11 13M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>'
);
