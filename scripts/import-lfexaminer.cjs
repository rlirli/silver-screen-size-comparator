const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

// Target paths
const dbPath = path.join(__dirname, "../public/cinema-database.json");
const outputDbPath = dbPath;

// Helper to sanitize text and generate clean slugs (identical to convert-db.js)
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD") // Remove accents
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .trim();
}

// Map LF Examiner format codes to human-readable projection types
function mapFormatCode(code) {
  if (!code) return undefined;
  const upper = code.toUpperCase().trim();
  switch (upper) {
    case "D":
      return "Digital Xenon";
    case "DL":
      return "Dual 4K Laser";
    case "DL2":
      return "Single 4K Laser / Dual Laser";
    case "1570":
      return "15/70mm Film";
    case "1570+D":
      return "15/70mm Film + Digital Xenon";
    case "1570+DL":
      return "15/70mm Film + Dual 4K Laser";
    case "1570+DL2":
      return "15/70mm Film + Single/Dual Laser";
    case "870":
      return "8/70mm Film";
    case "1070":
      return "10/70mm Film";
    default:
      return `${upper} Format`;
  }
}

async function run() {
  console.log("Loading existing database...");
  let database = { venues: [], screens: [] };
  if (fs.existsSync(dbPath)) {
    database = JSON.parse(fs.readFileSync(dbPath, "utf8"));
  }

  // Create lookups for deduplication
  const venueMap = new Map(database.venues.map((v) => [v.id, v]));
  const screenMap = new Map(database.screens.map((s) => [s.id, s]));

  console.log("Reading LF Examiner raw HTML source...");
  const cachePath =
    process.env.LF_EXAMINER_CACHE_FILE || path.join(__dirname, "lfexaminer_cache.html");
  let html;
  if (fs.existsSync(cachePath)) {
    console.log(`Using cached HTML from ${cachePath}`);
    html = fs.readFileSync(cachePath, "utf8");
  } else {
    console.log("Fetching live data from https://lfexaminer.com/theaters/ ...");
    const response = await fetch("https://lfexaminer.com/theaters/");
    if (!response.ok) throw new Error("Failed to fetch from live URL");
    html = await response.text();
  }

  const $ = cheerio.load(html);
  const rows = $("#tablepress-12 tbody tr");
  console.log(`Found ${rows.length} rows in the HTML table. Starting parsing...`);

  let addedVenues = 0;
  let addedScreens = 0;
  let mergedScreens = 0;

  rows.each((i, el) => {
    const cols = $(el).find("td, th");

    const country = $(cols[1]).text().trim();
    const city = $(cols[2]).text().trim();
    const state = $(cols[3]).text().trim();

    // Organization cell often contains links
    const orgCell = $(cols[4]);
    const cinemaName = orgCell.text().trim();
    const website = orgCell.find("a").attr("href") || undefined;

    const projSystem = $(cols[5]).text().trim();
    const formatCode = $(cols[7]).text().trim();
    const is3DText = $(cols[8]).text().trim();
    const flatDome = $(cols[9]).text().trim();
    const seatsText = $(cols[10]).text().trim();
    const sizeText = $(cols[11]).text().trim();
    const openedText = $(cols[12]).text().trim();
    const typeText = $(cols[13]).text().trim();

    if (!cinemaName || !city || !country) {
      // Skip empty header rows or invalid entries
      return;
    }

    // Generate stable Venue ID
    const countrySlug = generateSlug(country);
    const citySlug = generateSlug(city);
    const brandSlug = generateSlug(cinemaName);
    const venueId = `${countrySlug}_${citySlug}_${brandSlug}`;

    // Setup or get Venue
    let venue = venueMap.get(venueId);
    if (!venue) {
      venue = {
        id: venueId,
        name: cinemaName,
        brand: cinemaName.split(" ")[0] || undefined,
        location: {
          city,
          state: state || undefined,
          country,
          // Lat/lng coordinates are optional, set to undefined since we don't have them
          latitude: undefined,
          longitude: undefined,
        },
        openedDate: openedText ? openedText.replace(/\//g, "-") : undefined,
        website,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      database.venues.push(venue);
      venueMap.set(venueId, venue);
      addedVenues++;
    } else {
      // If venue exists, update openedDate if missing
      if (!venue.openedDate && openedText) {
        venue.openedDate = openedText.replace(/\//g, "-");
        venue.updatedAt = new Date().toISOString();
      }
    }

    // Parse Screen Dimensions from text (e.g. "39.2 x 70.7 ft./ 12.0 x 21.6 m.")
    let widthMeters = undefined;
    let heightMeters = undefined;
    let nativeAspectRatio = undefined;

    if (sizeText) {
      const metricMatch = sizeText.match(/([\d.]+)\s*x\s*([\d.]+)\s*m/i);
      if (metricMatch) {
        // LF Examiner typically formats sizes as Height x Width
        const h = parseFloat(metricMatch[1]);
        const w = parseFloat(metricMatch[2]);
        if (h > 0 && w > 0) {
          heightMeters = h;
          widthMeters = w;
          nativeAspectRatio = parseFloat((w / h).toFixed(3));
        }
      }
    }

    // Generate Screen ID
    const screenLocalId = generateSlug(projSystem || "screen");
    const screenId = `${venueId}#${screenLocalId}`;

    const parsedSeats = parseInt(seatsText, 10);
    const seats = isNaN(parsedSeats) ? undefined : parsedSeats;

    const standards = [];
    if (projSystem) {
      standards.push(projSystem);
    }

    const isDome = flatDome.toUpperCase() === "D" || flatDome.toLowerCase().includes("dome");
    const is3D = is3DText.toUpperCase() === "3D";

    // Map movies type code
    let moviesType = "commercial";
    if (typeText === "IN" || typeText === "I") {
      moviesType = "institutional";
    } else if (typeText === "both") {
      moviesType = "both";
    }

    // Check if screen already exists in database
    let screen = screenMap.get(screenId);
    if (!screen) {
      // Ensure we have valid dimensions to import, otherwise skip or default
      if (!widthMeters || !heightMeters) {
        // Skipping screens without dimensions because this is a size comparator tool
        return;
      }

      // Build field provenance map
      const provenance = {
        "dimensions.widthMeters": { sourceType: "lfexaminer", updatedAt: new Date().toISOString() },
        "dimensions.heightMeters": {
          sourceType: "lfexaminer",
          updatedAt: new Date().toISOString(),
        },
      };
      if (formatCode) {
        provenance["tech.formatCode"] = {
          sourceType: "lfexaminer",
          updatedAt: new Date().toISOString(),
        };
      }
      if (seats) {
        provenance["tech.numberOfSeats"] = {
          sourceType: "lfexaminer",
          updatedAt: new Date().toISOString(),
        };
      }

      screen = {
        id: screenId,
        venueId,
        name: projSystem || "Main Screen",
        dimensions: {
          widthMeters,
          heightMeters,
          nativeAspectRatio,
          isCurved: true, // Large format screens are typically curved
          isDome,
        },
        tech: {
          standards,
          projectionType: mapFormatCode(formatCode),
          formatCode: formatCode || undefined,
          is3D,
          numberOfSeats: seats,
        },
        moviesType,
        provenance,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      database.screens.push(screen);
      screenMap.set(screenId, screen);
      addedScreens++;
    } else {
      // If screen already exists, merge missing specs from LF Examiner
      let changed = false;
      if (seats && !screen.tech.numberOfSeats) {
        screen.tech.numberOfSeats = seats;
        screen.provenance["tech.numberOfSeats"] = {
          sourceType: "lfexaminer",
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
      if (formatCode && !screen.tech.formatCode) {
        screen.tech.formatCode = formatCode;
        screen.tech.projectionType = screen.tech.projectionType || mapFormatCode(formatCode);
        screen.provenance["tech.formatCode"] = {
          sourceType: "lfexaminer",
          updatedAt: new Date().toISOString(),
        };
        changed = true;
      }
      if (changed) {
        screen.updatedAt = new Date().toISOString();
        mergedScreens++;
      }
    }
  });

  console.log("Writing back merged database to public/cinema-database.json...");
  fs.writeFileSync(outputDbPath, JSON.stringify(database, null, 2), "utf8");

  console.log("\n--- Ingestion Stats ---");
  console.log(`Total Venues in database: ${database.venues.length} (+${addedVenues} added)`);
  console.log(
    `Total Screens in database: ${database.screens.length} (+${addedScreens} added, ${mergedScreens} merged/updated)`,
  );
  console.log("Ingestion completed successfully!");
}

run().catch(console.error);
