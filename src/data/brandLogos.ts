interface LogoEntry {
  url: string;
  aspect: 'square' | 'wide'; // wide = real wordmark, given more horizontal room instead of a cramped square crop
}

// Maps a loyalty programme's exact name to its real logo asset.
// Add an entry here once a verified logo/icon is available for that
// programme -- everything else automatically falls back to the
// abstract BrandMark shape until then.
export const BRAND_LOGOS: Record<string, LogoEntry> = {
  'Accor ALL': { url: '/brand-logos/accor.jpg', aspect: 'square' },
  'Marriott Bonvoy': { url: '/brand-logos/marriott-wordmark.png', aspect: 'wide' },
  'Qantas Points': { url: '/brand-logos/qantas.png', aspect: 'square' },
  'Singapore KrisFlyer': { url: '/brand-logos/singapore-airlines.png', aspect: 'square' },
  'Virgin Points': { url: '/brand-logos/virgin-atlantic.png', aspect: 'square' },
  'Expedia One Key Cash': { url: '/brand-logos/expedia.png', aspect: 'square' },
  'Hilton Honors': { url: '/brand-logos/hilton.png', aspect: 'wide' },
  'IHG One Rewards': { url: '/brand-logos/ihg.png', aspect: 'wide' },
  'World of Hyatt': { url: '/brand-logos/hyatt.png', aspect: 'wide' },
};

export function hasWordmarkLogo(name: string): boolean {
  return BRAND_LOGOS[name]?.aspect === 'wide';
}
