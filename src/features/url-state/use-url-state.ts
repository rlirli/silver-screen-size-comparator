import { useQueryStates, parseAsString, parseAsBoolean, parseAsArrayOf, parseAsJson } from "nuqs";
import { z } from "zod";

export interface CustomScreen {
  id: string;
  name: string;
  width: number;
  height: number;
}

const CustomScreenSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number(),
  height: z.number(),
});

// Define the central state schema for the application
export const urlStateSchema = {
  // Explorer filters & list state
  search: parseAsString.withDefault(""),
  standards: parseAsArrayOf(parseAsString).withDefault([]),
  movies: parseAsString.withDefault("both"), // 'commercial' | 'institutional' | 'both'
  sortBy: parseAsString.withDefault("screen.area"),
  sortDesc: parseAsBoolean.withDefault(true),
  mapRects: parseAsString.withDefault("selected"), // 'all' | 'selected' | 'none'
  explorerTab: parseAsString.withDefault("list"), // 'list' | 'map' | 'split'

  // Comparator state
  selected: parseAsArrayOf(parseAsString).withDefault([
    "germany_leonberg_imax-leonberg#imax",
    "usa_new-york_amc-lincoln-square-13-imax#imax",
    "france_paris_pathe-la-villette-imax#imax",
  ]),
  order: parseAsArrayOf(parseAsString).withDefault([]),
  custom: parseAsJson<CustomScreen[]>((val) => {
    const parsed = z.array(CustomScreenSchema).safeParse(val);
    return parsed.success ? parsed.data : null;
  }).withDefault([]),
  view: parseAsString.withDefault("2d"), // '2d' | '3d'
  layout: parseAsString.withDefault("horizontal"), // 'horizontal' | 'vertical' | 'stacked' | 'surround'
  mask: parseAsString.withDefault("none"), // 'none' | '1.43' | '1.89' | '2.39' etc.
  maskMode: parseAsString.withDefault("darken"), // 'darken' | 'crop'
  showLabels: parseAsBoolean.withDefault(true),
  showArea: parseAsBoolean.withDefault(true),
  showMannequin: parseAsBoolean.withDefault(true),

  // Redesign Layout state
  compState: parseAsString.withDefault("small"), // 'hidden' | 'small' | 'fullscreen'
  compPlacement: parseAsString.withDefault("bottom"), // 'bottom' | 'right' | 'left'
  mobileTab: parseAsString.withDefault("explore"), // 'explore' | 'compare'

  // Theme state
  theme: parseAsString.withDefault("system"), // 'light' | 'dark' | 'system'
};

export function useUrlState() {
  return useQueryStates(urlStateSchema, {
    history: "push", // Use push state so user can use back/forward browser buttons
    clearOnDefault: false, // Keep parameters in URL even if they match defaults for direct copying
  });
}
