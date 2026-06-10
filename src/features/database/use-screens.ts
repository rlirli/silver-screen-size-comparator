import { useQuery } from "@tanstack/react-query";
import { VenueSchema, ScreenSchema, type CinemaScreen, type Venue, type Screen } from "./schema";
import { z } from "zod";

const DatabaseFileSchema = z.object({
  venues: z.array(VenueSchema),
  screens: z.array(ScreenSchema),
});

const fetchDatabase = async (): Promise<CinemaScreen[]> => {
  const response = await fetch("/cinema-database.json");
  if (!response.ok) {
    throw new Error("Failed to fetch cinema database");
  }
  const rawData = await response.json();

  // Validate database collections
  const parsed = DatabaseFileSchema.safeParse(rawData);
  if (!parsed.success) {
    console.error("Database schema validation failed:", parsed.error);
    // In case of parsing issues, fallback safely
    const data = rawData as { venues: Venue[]; screens: Screen[] };
    return joinVenuesAndScreens(data.venues || [], data.screens || []);
  }

  return joinVenuesAndScreens(parsed.data.venues, parsed.data.screens);
};

// Helper function to map Venue & Screen relations to the unified CinemaScreen structure
function joinVenuesAndScreens(venues: Venue[], screens: Screen[]): CinemaScreen[] {
  const venueMap = new Map<string, Venue>();
  venues.forEach((v) => venueMap.set(v.id, v));

  return screens.map((s) => {
    const venue: Venue = venueMap.get(s.venueId) || {
      id: s.venueId,
      name: "Unknown Cinema",
      location: { city: "Unknown", country: "Unknown", latitude: 0, longitude: 0 },
      openedDate: undefined,
      closedDate: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return {
      ...s,
      venue,
    };
  });
}

export function useScreens() {
  return useQuery({
    queryKey: ["screens"],
    queryFn: fetchDatabase,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
}
