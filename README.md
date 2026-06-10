# Silver Screen Size Comparator

An interactive web application to compare and explore cinema screen sizes around the world, specializing in premium large formats (IMAX, Dolby Cinema, etc.).

## Features

- **Interactive Size Comparator**: Visually compare multiple screens side-by-side or stacked, with support for curved screen visualization and aspect ratio masking (e.g. 1.43:1, 1.89:1, 2.39:1).
- **Global Screen Explorer**: Search, filter, and sort screens by format, name, country, dimensions, or total area.
- **Geographic Mapping**: View screen locations on a map using MapLibre GL / React Map GL.
- **Data Export**: Export your filtered database selections as CSV or JSON.

## Data Source & Attribution

The cinema screen size database (`public/cinema-database.json`) contains records sourced and compiled from **LF Examiner** (https://lfexaminer.com/theaters/). Additionally, city-level geographic coordinates in the database are resolved offline using data sourced from **GeoNames** (https://www.geonames.org/), which is licensed under the **Creative Commons Attribution 4.0 International (CC BY 4.0)** license.

As of March 1, 2025, all LF Examiner content is licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** license.

To comply with the terms of the LF Examiner data license:

1. **Attribution**: You must attribute any data reuse to LF Examiner.
2. **Non-Commercial**: You cannot use this database for commercial purposes.
3. **Share-Alike**: If you remix, transform, or build upon this database, you must distribute your contributions under the same CC BY-NC-SA 4.0 license.

## License

This project utilizes a split-licensing model:

- **Database / Data Content** (`public/cinema-database.json`): Licensed under the **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)** license. See [LICENSE](LICENSE) for details.
- **Application Code**: Licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## Development Setup

This project is built using **React**, **TypeScript**, and **Vite**, run via **Bun**.

### Prerequisites

- Bun (v1.0 or higher)

### Installation

1. Install dependencies:

   ```bash
   bun install
   ```

2. Start the local development server:

   ```bash
   bun dev
   ```

3. Build for production:

   ```bash
   bun run build
   ```

4. Update the theater database (Import + Geocode):
   ```bash
   bun run db:update
   ```
   This pipeline executes two decoupled steps:
   - `bun run db:import-lfexaminer`: Parses the LF Examiner theater directory to ingest and merge screen formats, dimensions, websites, and opening dates.
   - `bun run db:geocode`: Downloads the GeoNames `cities15000` database offline to resolve and map latitude/longitude coordinates for any unlocated cities.
