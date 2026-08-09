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
export const CaptureIcon = wrap(
  '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/>'
);
export const DiscoverIcon = wrap(
  '<path d="M12 3.5 13.9 9l5.6.3-4.4 3.5 1.5 5.4L12 15.2 7.4 18.2l1.5-5.4L4.5 9.3 10.1 9z"/>'
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
export const BackIcon = wrap('<path d="M15 5 8 12l7 7"/>');
