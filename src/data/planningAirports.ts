// Airports with their city-centre coordinates, so transfer distance can be
// computed from real geography rather than guessed. Coordinates are real;
// this list is deliberately partial (major hubs only) rather than pretending
// to be a complete global airport database.

export interface PlanningAirport {
  iata: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  country: string;
  cityLat: number;
  cityLng: number;
}

export const PLANNING_AIRPORTS: PlanningAirport[] = [
  // --- United Kingdom (home) ---
  { iata: 'LHR', name: 'Heathrow', lat: 51.4700, lng: -0.4543, city: 'London', country: 'United Kingdom', cityLat: 51.5074, cityLng: -0.1278 },
  { iata: 'LGW', name: 'Gatwick', lat: 51.1481, lng: -0.1903, city: 'London', country: 'United Kingdom', cityLat: 51.5074, cityLng: -0.1278 },
  { iata: 'STN', name: 'Stansted', lat: 51.8860, lng: 0.2389, city: 'London', country: 'United Kingdom', cityLat: 51.5074, cityLng: -0.1278 },
  { iata: 'LTN', name: 'Luton', lat: 51.8747, lng: -0.3683, city: 'London', country: 'United Kingdom', cityLat: 51.5074, cityLng: -0.1278 },
  { iata: 'LCY', name: 'City', lat: 51.5053, lng: 0.0553, city: 'London', country: 'United Kingdom', cityLat: 51.5074, cityLng: -0.1278 },
  { iata: 'MAN', name: 'Manchester', lat: 53.3537, lng: -2.2750, city: 'Manchester', country: 'United Kingdom', cityLat: 53.4808, cityLng: -2.2426 },
  { iata: 'EDI', name: 'Edinburgh', lat: 55.9500, lng: -3.3725, city: 'Edinburgh', country: 'United Kingdom', cityLat: 55.9533, cityLng: -3.1883 },

  // --- Japan ---
  { iata: 'HND', name: 'Haneda', lat: 35.5494, lng: 139.7798, city: 'Tokyo', country: 'Japan', cityLat: 35.6762, cityLng: 139.6503 },
  { iata: 'NRT', name: 'Narita', lat: 35.7720, lng: 140.3929, city: 'Tokyo', country: 'Japan', cityLat: 35.6762, cityLng: 139.6503 },
  { iata: 'KIX', name: 'Kansai', lat: 34.4347, lng: 135.2441, city: 'Osaka', country: 'Japan', cityLat: 34.6937, cityLng: 135.5023 },
  { iata: 'ITM', name: 'Itami', lat: 34.7855, lng: 135.4382, city: 'Osaka', country: 'Japan', cityLat: 34.6937, cityLng: 135.5023 },
  { iata: 'HIJ', name: 'Hiroshima', lat: 34.4361, lng: 132.9195, city: 'Hiroshima', country: 'Japan', cityLat: 34.3853, cityLng: 132.4553 },
  { iata: 'CTS', name: 'New Chitose', lat: 42.7752, lng: 141.6923, city: 'Sapporo', country: 'Japan', cityLat: 43.0618, cityLng: 141.3545 },
  { iata: 'FUK', name: 'Fukuoka', lat: 33.5859, lng: 130.4506, city: 'Fukuoka', country: 'Japan', cityLat: 33.5904, cityLng: 130.4017 },
  { iata: 'OKA', name: 'Naha', lat: 26.1958, lng: 127.6458, city: 'Okinawa', country: 'Japan', cityLat: 26.2124, cityLng: 127.6809 },

  // --- Europe ---
  { iata: 'CDG', name: 'Charles de Gaulle', lat: 49.0097, lng: 2.5479, city: 'Paris', country: 'France', cityLat: 48.8566, cityLng: 2.3522 },
  { iata: 'AMS', name: 'Schiphol', lat: 52.3086, lng: 4.7639, city: 'Amsterdam', country: 'Netherlands', cityLat: 52.3676, cityLng: 4.9041 },
  { iata: 'MAD', name: 'Barajas', lat: 40.4983, lng: -3.5676, city: 'Madrid', country: 'Spain', cityLat: 40.4168, cityLng: -3.7038 },
  { iata: 'BCN', name: 'El Prat', lat: 41.2971, lng: 2.0785, city: 'Barcelona', country: 'Spain', cityLat: 41.3874, cityLng: 2.1686 },
  { iata: 'FCO', name: 'Fiumicino', lat: 41.8003, lng: 12.2389, city: 'Rome', country: 'Italy', cityLat: 41.9028, cityLng: 12.4964 },
  { iata: 'VCE', name: 'Marco Polo', lat: 45.5053, lng: 12.3519, city: 'Venice', country: 'Italy', cityLat: 45.4408, cityLng: 12.3155 },
  { iata: 'BER', name: 'Brandenburg', lat: 52.3667, lng: 13.5033, city: 'Berlin', country: 'Germany', cityLat: 52.5200, cityLng: 13.4050 },
  { iata: 'VIE', name: 'Vienna', lat: 48.1103, lng: 16.5697, city: 'Vienna', country: 'Austria', cityLat: 48.2082, cityLng: 16.3738 },
  { iata: 'PRG', name: 'Václav Havel', lat: 50.1008, lng: 14.2600, city: 'Prague', country: 'Czechia', cityLat: 50.0755, cityLng: 14.4378 },
  { iata: 'LIS', name: 'Humberto Delgado', lat: 38.7756, lng: -9.1354, city: 'Lisbon', country: 'Portugal', cityLat: 38.7223, cityLng: -9.1393 },
  { iata: 'ATH', name: 'Eleftherios Venizelos', lat: 37.9364, lng: 23.9445, city: 'Athens', country: 'Greece', cityLat: 37.9838, cityLng: 23.7275 },
  { iata: 'IST', name: 'Istanbul', lat: 41.2753, lng: 28.7519, city: 'Istanbul', country: 'Turkey', cityLat: 41.0082, cityLng: 28.9784 },
  { iata: 'DLM', name: 'Dalaman', lat: 36.7131, lng: 28.7925, city: 'Dalaman', country: 'Turkey', cityLat: 36.7712, cityLng: 28.8065 },
  { iata: 'AYT', name: 'Antalya', lat: 36.8987, lng: 30.8005, city: 'Antalya', country: 'Turkey', cityLat: 36.8969, cityLng: 30.7133 },
  { iata: 'DUB', name: 'Dublin', lat: 53.4213, lng: -6.2701, city: 'Dublin', country: 'Ireland', cityLat: 53.3498, cityLng: -6.2603 },
  { iata: 'ARN', name: 'Arlanda', lat: 59.6519, lng: 17.9186, city: 'Stockholm', country: 'Sweden', cityLat: 59.3293, cityLng: 18.0686 },

  // --- Middle East / Asia ---
  { iata: 'DXB', name: 'Dubai', lat: 25.2532, lng: 55.3657, city: 'Dubai', country: 'UAE', cityLat: 25.2048, cityLng: 55.2708 },
  { iata: 'AUH', name: 'Abu Dhabi', lat: 24.4330, lng: 54.6511, city: 'Abu Dhabi', country: 'UAE', cityLat: 24.4539, cityLng: 54.3773 },
  { iata: 'DOH', name: 'Hamad', lat: 25.2731, lng: 51.6081, city: 'Doha', country: 'Qatar', cityLat: 25.2854, cityLng: 51.5310 },
  { iata: 'SIN', name: 'Changi', lat: 1.3644, lng: 103.9915, city: 'Singapore', country: 'Singapore', cityLat: 1.3521, cityLng: 103.8198 },
  { iata: 'BKK', name: 'Suvarnabhumi', lat: 13.6900, lng: 100.7501, city: 'Bangkok', country: 'Thailand', cityLat: 13.7563, cityLng: 100.5018 },
  { iata: 'HKG', name: 'Hong Kong', lat: 22.3080, lng: 113.9185, city: 'Hong Kong', country: 'Hong Kong', cityLat: 22.3193, cityLng: 114.1694 },
  { iata: 'ICN', name: 'Incheon', lat: 37.4602, lng: 126.4407, city: 'Seoul', country: 'South Korea', cityLat: 37.5665, cityLng: 126.9780 },
  { iata: 'KUL', name: 'Kuala Lumpur', lat: 2.7456, lng: 101.7099, city: 'Kuala Lumpur', country: 'Malaysia', cityLat: 3.1390, cityLng: 101.6869 },
  { iata: 'DPS', name: 'Ngurah Rai', lat: -8.7482, lng: 115.1675, city: 'Bali', country: 'Indonesia', cityLat: -8.6500, cityLng: 115.2167 },
  { iata: 'DEL', name: 'Indira Gandhi', lat: 28.5562, lng: 77.1000, city: 'Delhi', country: 'India', cityLat: 28.6139, cityLng: 77.2090 },
  { iata: 'BOM', name: 'Chhatrapati Shivaji', lat: 19.0896, lng: 72.8656, city: 'Mumbai', country: 'India', cityLat: 19.0760, cityLng: 72.8777 },
  { iata: 'GOX', name: 'Manohar (Goa)', lat: 15.7414, lng: 73.8583, city: 'Goa', country: 'India', cityLat: 15.2993, cityLng: 74.1240 },

  // --- Oceania ---
  { iata: 'SYD', name: 'Kingsford Smith', lat: -33.9399, lng: 151.1753, city: 'Sydney', country: 'Australia', cityLat: -33.8688, cityLng: 151.2093 },
  { iata: 'MEL', name: 'Tullamarine', lat: -37.6690, lng: 144.8410, city: 'Melbourne', country: 'Australia', cityLat: -37.8136, cityLng: 144.9631 },
  { iata: 'BNE', name: 'Brisbane', lat: -27.3842, lng: 153.1175, city: 'Brisbane', country: 'Australia', cityLat: -27.4698, cityLng: 153.0251 },
  { iata: 'PER', name: 'Perth', lat: -31.9385, lng: 115.9672, city: 'Perth', country: 'Australia', cityLat: -31.9505, cityLng: 115.8605 },
  { iata: 'AKL', name: 'Auckland', lat: -37.0082, lng: 174.7850, city: 'Auckland', country: 'New Zealand', cityLat: -36.8485, cityLng: 174.7633 },

  // --- Americas ---
  { iata: 'JFK', name: 'John F. Kennedy', lat: 40.6413, lng: -73.7781, city: 'New York', country: 'United States', cityLat: 40.7128, cityLng: -74.0060 },
  { iata: 'EWR', name: 'Newark', lat: 40.6895, lng: -74.1745, city: 'New York', country: 'United States', cityLat: 40.7128, cityLng: -74.0060 },
  { iata: 'LAX', name: 'Los Angeles', lat: 33.9416, lng: -118.4085, city: 'Los Angeles', country: 'United States', cityLat: 34.0522, cityLng: -118.2437 },
  { iata: 'SFO', name: 'San Francisco', lat: 37.6213, lng: -122.3790, city: 'San Francisco', country: 'United States', cityLat: 37.7749, cityLng: -122.4194 },
  { iata: 'YYZ', name: 'Pearson', lat: 43.6777, lng: -79.6248, city: 'Toronto', country: 'Canada', cityLat: 43.6532, cityLng: -79.3832 },
  { iata: 'YVR', name: 'Vancouver', lat: 49.1967, lng: -123.1815, city: 'Vancouver', country: 'Canada', cityLat: 49.2827, cityLng: -123.1207 },
  { iata: 'CUN', name: 'Cancún', lat: 21.0365, lng: -86.8771, city: 'Cancún', country: 'Mexico', cityLat: 21.1619, cityLng: -86.8515 },
  { iata: 'SCL', name: 'Arturo Merino Benítez', lat: -33.3930, lng: -70.7858, city: 'Santiago', country: 'Chile', cityLat: -33.4489, cityLng: -70.6693 },
  { iata: 'LIM', name: 'Jorge Chávez', lat: -12.0219, lng: -77.1143, city: 'Lima', country: 'Peru', cityLat: -12.0464, cityLng: -77.0428 },
];

export const PLANNING_AIRPORTS_BY_IATA: Record<string, PlanningAirport> = Object.fromEntries(
  PLANNING_AIRPORTS.map((a) => [a.iata, a])
);

export function airportsForCountry(country: string): PlanningAirport[] {
  return PLANNING_AIRPORTS.filter((a) => a.country === country);
}

export function planningCountries(): string[] {
  return [...new Set(PLANNING_AIRPORTS.map((a) => a.country))].sort();
}
