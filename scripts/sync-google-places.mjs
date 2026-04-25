import fs from 'fs';
import path from 'path';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, 'public', 'lokales', 'data', 'locations.json');

if (!API_KEY) {
  console.error('Fehlt: GOOGLE_PLACES_API_KEY');
  process.exit(1);
}

function normalizeGoogleHours(place) {
  const weekdays =
    place?.regularOpeningHours?.weekdayDescriptions ||
    place?.currentOpeningHours?.weekdayDescriptions ||
    [];

  return weekdays.map((line) => {
    const parts = String(line).split(':');
    if (parts.length < 2) {
      return { days: String(line), hours: '' };
    }

    return {
      days: parts.shift().trim(),
      hours: parts.join(':').trim()
    };
  });
}

async function fetchPlace(placeId) {
  const fields = [
    'id',
    'displayName',
    'formattedAddress',
    'regularOpeningHours',
    'currentOpeningHours',
    'googleMapsUri'
  ].join(',');

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=${fields}&key=${API_KEY}`
  );

  if (!response.ok) {
    throw new Error(`Google Places Fehler ${response.status}`);
  }

  return response.json();
}

async function main() {
  const locations = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));

  for (const location of locations) {
    const placeId = location?.google?.placeId;
    if (!placeId || location.openingHoursMode !== 'google') continue;

    const place = await fetchPlace(placeId);

    location.openingHoursResolved = normalizeGoogleHours(place);
    location.openingHoursSource = 'google';

    location.google = {
      ...location.google,
      placeId,
      googleMapsUri: place.googleMapsUri || location.mapsLink || ''
    };

    if (place.formattedAddress && !location.address) {
      location.address = place.formattedAddress;
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(locations, null, 2), 'utf-8');
  console.log('✅ Google-Öffnungszeiten synchronisiert.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});