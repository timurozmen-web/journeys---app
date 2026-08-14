import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-50m.json';

// Parsed once, shared by any component that needs country boundaries --
// each component still builds its own projection (world-fitted vs
// per-trip zoomed), but the underlying geometry data itself is loaded
// only once rather than bundled separately per consumer.
export const worldGeo = feature(worldTopo as any, (worldTopo as any).objects.countries) as any;
