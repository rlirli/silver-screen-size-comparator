import { z } from "zod";

// Provenance schema for field-level trust tracking
export const SourceMetadataSchema = z.object({
  sourceType: z.enum(["operator", "lfexaminer", "user_contributed", "estimated"]),
  updatedAt: z.string().transform((val) => new Date(val)),
  sourceUrl: z.url().optional(),
  confidence: z.enum(["low", "medium", "high"]).optional(),
});

export const LocationSchema = z.object({
  city: z.string(),
  state: z.string().optional(), // State code/name for US/Canada
  country: z.string(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// Venue Schema (Cinema House / Multiplex)
export const VenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  location: LocationSchema,
  openedDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  closedDate: z
    .string()
    .optional()
    .transform((val) => (val ? new Date(val) : undefined)),
  externalIds: z
    .object({
      wikidata: z.string().optional(),
      osm: z.string().optional(),
    })
    .optional(),
  website: z.url().optional(),
  createdAt: z.string().transform((val) => new Date(val)),
  updatedAt: z.string().transform((val) => new Date(val)),
});

// Screen Schema (Auditorium)
export const ScreenSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  name: z.string(),
  dimensions: z.object({
    widthMeters: z.number().positive(),
    heightMeters: z.number().positive(),
    nativeAspectRatio: z.number().positive(),
    isCurved: z.boolean().default(false),
    isDome: z.boolean().default(false),
  }),
  tech: z.object({
    standards: z.array(z.string()).default([]),
    projectionType: z.string().optional(),
    formatCode: z.string().optional(),
    is3D: z.boolean().default(false),
    audioEquipment: z.string().optional(),
    numberOfSeats: z.number().positive().optional(),
  }),
  moviesType: z.enum(["commercial", "institutional", "both"]).default("commercial"),
  provenance: z.record(z.string(), SourceMetadataSchema).default({}),
  createdAt: z.string().transform((val) => new Date(val)),
  updatedAt: z.string().transform((val) => new Date(val)),
});

// Combined joined type for components
export type CinemaScreen = Screen & {
  venue: Venue;
};

export type Venue = z.infer<typeof VenueSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type SourceMetadata = z.infer<typeof SourceMetadataSchema>;
export type Location = z.infer<typeof LocationSchema>;
