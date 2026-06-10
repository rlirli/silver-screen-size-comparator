const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Database path
const dbPath = path.join(__dirname, "../public/cinema-database.json");

// Helper to sanitize text and generate clean slugs (identical to import script)
function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD") // Remove accents
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .trim();
}

const countryToIso = {
  angola: "ao",
  argentina: "ar",
  australia: "au",
  austria: "at",
  azerbaijan: "az",
  bahamas: "bs",
  bahrain: "bh",
  bangladesh: "bd",
  belgium: "be",
  brazil: "br",
  bulgaria: "bg",
  canada: "ca",
  chile: "cl",
  china: "cn",
  colombia: "co",
  "costa rica": "cr",
  croatia: "hr",
  cyprus: "cy",
  "czech republic": "cz",
  denmark: "dk",
  ecuador: "ec",
  egypt: "eg",
  estonia: "ee",
  finland: "fi",
  france: "fr",
  germany: "de",
  greece: "gr",
  guatemala: "gt",
  honduras: "hn",
  "hong kong": "hk",
  hungary: "hu",
  india: "in",
  indonesia: "id",
  iraq: "iq",
  ireland: "ie",
  israel: "il",
  italy: "it",
  jamaica: "jm",
  japan: "jp",
  jordan: "jo",
  kazakhstan: "kz",
  kenya: "ke",
  kuwait: "kw",
  latvia: "lv",
  lebanon: "lb",
  lithuania: "lt",
  luxembourg: "lu",
  macau: "mo",
  malaysia: "my",
  mexico: "mx",
  mongolia: "mn",
  morocco: "ma",
  netherlands: "nl",
  "new zealand": "nz",
  nigeria: "ng",
  norway: "no",
  oman: "om",
  pakistan: "pk",
  panama: "pa",
  paraguay: "py",
  peru: "pe",
  philippines: "ph",
  poland: "pl",
  portugal: "pt",
  "puerto rico": "pr",
  qatar: "qa",
  romania: "ro",
  russia: "ru",
  "saudi arabia": "sa",
  serbia: "rs",
  singapore: "sg",
  slovakia: "sk",
  slovenia: "si",
  "south africa": "za",
  "south korea": "kr",
  spain: "es",
  "sri lanka": "lk",
  sweden: "se",
  switzerland: "ch",
  taiwan: "tw",
  thailand: "th",
  trinidad: "tt",
  turkey: "tr",
  ukraine: "ua",
  "united arab emirates": "ae",
  uae: "ae",
  "united kingdom": "gb",
  uk: "gb",
  "united states": "us",
  usa: "us",
  uruguay: "uy",
  uzbekistan: "uz",
  venezuela: "ve",
  vietnam: "vn",
};

async function downloadGeonamesIfNeeded() {
  const zipPath = path.join(__dirname, "cities15000.zip");
  const txtPath = path.join(__dirname, "cities15000.txt");

  if (fs.existsSync(txtPath)) {
    console.log("GeoNames cities15000.txt already exists locally.");
    return txtPath;
  }

  if (!fs.existsSync(zipPath)) {
    console.log("Downloading GeoNames cities15000.zip (~6.3MB)...");
    const res = await fetch("http://download.geonames.org/export/dump/cities15000.zip");
    if (!res.ok) throw new Error(`Failed to download GeoNames dataset: ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(zipPath, Buffer.from(buffer));
    console.log("Download complete.");
  }

  console.log("Extracting cities15000.zip...");
  try {
    execSync(`unzip -o "${zipPath}" -d "${__dirname}"`);
    console.log("Extraction successful.");
  } catch (err) {
    console.error("Failed to extract using system unzip command.", err);
    throw err;
  }

  // Clean up the zip file to save space
  try {
    fs.unlinkSync(zipPath);
  } catch {}

  return txtPath;
}

function loadGeonamesCoords(txtPath) {
  console.log("Parsing GeoNames cities database...");
  const coordsMap = new Map();
  const content = fs.readFileSync(txtPath, "utf8");
  const lines = content.split("\n");

  for (const line of lines) {
    if (!line) continue;
    const parts = line.split("\t");
    if (parts.length < 10) continue;

    const name = parts[2].trim().toLowerCase(); // asciiname
    const latitude = parseFloat(parts[4]);
    const longitude = parseFloat(parts[5]);
    const countryCode = parts[8].trim().toLowerCase(); // ISO 2-letter country code

    if (isNaN(latitude) || isNaN(longitude)) continue;

    const key = `${countryCode}_${generateSlug(name)}`;
    coordsMap.set(key, { latitude, longitude });
  }

  console.log(`Loaded coordinates for ${coordsMap.size} cities.`);
  return coordsMap;
}

async function run() {
  console.log("Loading database...");
  if (!fs.existsSync(dbPath)) {
    console.error(`Database not found at ${dbPath}`);
    process.exit(1);
  }

  const database = JSON.parse(fs.readFileSync(dbPath, "utf8"));

  // Find venues that lack coordinates
  const unlocatedVenues = database.venues.filter(
    (v) => v.location.latitude === undefined || v.location.longitude === undefined,
  );

  if (unlocatedVenues.length === 0) {
    console.log("All venues already have coordinates resolved. Nothing to do.");
    return;
  }

  console.log(
    `Found ${unlocatedVenues.length} / ${database.venues.length} venues missing coordinates.`,
  );

  let coordsMap = new Map();
  try {
    const txtPath = await downloadGeonamesIfNeeded();
    coordsMap = loadGeonamesCoords(txtPath);
  } catch (err) {
    console.error("Failed to load GeoNames coordinate database. Aborting geocoding:", err);
    process.exit(1);
  }

  let resolvedCount = 0;
  let skippedCount = 0;

  for (const venue of unlocatedVenues) {
    const country = venue.location.country || "";
    const city = venue.location.city || "";
    const iso = countryToIso[country.toLowerCase().trim()];

    if (!iso) {
      console.warn(
        `[Warning] No ISO mapping found for country: "${country}" (Venue: ${venue.name})`,
      );
      skippedCount++;
      continue;
    }

    const geoKey = `${iso}_${generateSlug(city)}`;
    const coords = coordsMap.get(geoKey);

    if (coords) {
      venue.location.latitude = coords.latitude;
      venue.location.longitude = coords.longitude;
      venue.updatedAt = new Date().toISOString();
      resolvedCount++;
    } else {
      console.warn(
        `[Warning] Could not resolve coordinates for city: "${city}, ${country}" (key: ${geoKey})`,
      );
      skippedCount++;
    }
  }

  if (resolvedCount > 0) {
    console.log(`Successfully geocoded ${resolvedCount} venues.`);
    console.log(`Writing back to database at ${dbPath}...`);
    fs.writeFileSync(dbPath, JSON.stringify(database, null, 2), "utf8");
  } else {
    console.log("No new coordinates resolved.");
  }

  console.log("\n--- Geocoding Stats ---");
  console.log(`Resolved: ${resolvedCount}`);
  console.log(`Unresolved / Skipped: ${skippedCount}`);
}

run().catch(console.error);
