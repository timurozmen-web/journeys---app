import { supabase } from './supabase';

export interface BudgetCityLeg {
  city: string;
  country: string;
  nights: number;
  checkIn: string;
}

export interface BudgetEstimate {
  flightEstimateGBP: [number, number];
  hotelEstimates: { city: string; perNightGBP: [number, number] }[];
  foodPerDayGBP: [number, number];
  totalEstimateGBP: [number, number];
  notes: string;
}

// Calls the plan-budget-estimate Edge Function -- an on-demand (not
// scheduled) research call using Claude + web search, same pattern as
// the Discover daily scan and the same ANTHROPIC_API_KEY secret. This
// is explicitly a researched ballpark, not live/guaranteed pricing --
// takes 10-30 seconds and costs a small amount per call, which is why
// this is only ever triggered by an explicit button tap, never
// automatically.
export async function getBudgetEstimate(homeAirport: string, homeCity: string, startDate: string, cities: BudgetCityLeg[]): Promise<BudgetEstimate> {
  const { data, error } = await supabase.functions.invoke('plan-budget-estimate', {
    body: { homeAirport, homeCity, startDate, cities },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as BudgetEstimate;
}
