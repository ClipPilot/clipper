import { link } from "@elevenlabs/elevenlabs-js/api/resources/conversationalAi/resources/agents/resources";

const DEVICES = [
  // { make: "Apple", model: "iPhone 16 Pro Max", software: "18.2" },
  // { make: "Apple", model: "iPhone 16 Pro", software: "18.2" },
  // { make: "Apple", model: "iPhone 16 Plus", software: "18.1.1" },
  // { make: "Apple", model: "iPhone 16", software: "18.1" },
  // { make: "Apple", model: "iPhone 15 Pro Max", software: "18.2" },
  // { make: "Apple", model: "iPhone 15 Pro", software: "17.7.2" },
  // { make: "Apple", model: "iPhone 15 Plus", software: "17.6.1" },
  // { make: "Apple", model: "iPhone 15", software: "17.5.1" },
  // { make: "Apple", model: "iPhone 14 Pro Max", software: "18.1" },
  // { make: "Apple", model: "iPhone 14 Pro", software: "17.7.1" },
  // { make: "Apple", model: "iPhone 14 Plus", software: "17.4.1" },
  // { make: "Apple", model: "iPhone 14", software: "18.0" },
  // { make: "Apple", model: "iPhone 13 Pro Max", software: "17.6.1" },
  // { make: "Apple", model: "iPhone 13 Pro", software: "17.5.1" },
  // { make: "Apple", model: "iPhone 13", software: "18.1" },
  // { make: "samsung", model: "SM-S928U", software: "" },
  // { make: "samsung", model: "SM-S926U", software: "" },
  // { make: "samsung", model: "SM-S921U", software: "" },
  // { make: "samsung", model: "SM-S918U", software: "" },
  { make: "Samsung", model: "SM-S938U", software: "One UI 7.0" },
  // { make: "Google", model: "Pixel 9 Pro XL", software: "" },
  // { make: "Google", model: "Pixel 9 Pro", software: "" },
  // { make: "Google", model: "Pixel 9", software: "" },
  // { make: "Google", model: "Pixel 8 Pro", software: "" },
  // { make: "Google", model: "Pixel 8", software: "" },
];

const LOCATIONS = [
  { lat: 34.0522, lng: -118.2437, alt: 71, tz: "America/Los_Angeles" },
  { lat: 40.7128, lng: -74.006, alt: 10, tz: "America/New_York" },
  { lat: 25.7617, lng: -80.1918, alt: 2, tz: "America/New_York" },
  { lat: 33.749, lng: -84.388, alt: 320, tz: "America/New_York" },
  { lat: 41.8781, lng: -87.6298, alt: 181, tz: "America/Chicago" },
  { lat: 29.7604, lng: -95.3698, alt: 15, tz: "America/Chicago" },
  { lat: 32.7767, lng: -96.797, alt: 131, tz: "America/Chicago" },
  { lat: 47.6062, lng: -122.3321, alt: 56, tz: "America/Los_Angeles" },
  { lat: 37.7749, lng: -122.4194, alt: 16, tz: "America/Los_Angeles" },
  { lat: 36.1699, lng: -115.1398, alt: 610, tz: "America/Los_Angeles" },
  { lat: 33.4484, lng: -112.074, alt: 331, tz: "America/Phoenix" },
  { lat: 39.7392, lng: -104.9903, alt: 1609, tz: "America/Denver" },
  { lat: 36.1627, lng: -86.7816, alt: 182, tz: "America/Chicago" },
  { lat: 42.3601, lng: -71.0589, alt: 6, tz: "America/New_York" },
  { lat: 45.5152, lng: -122.6784, alt: 15, tz: "America/Los_Angeles" },
  { lat: 32.7157, lng: -117.1611, alt: 19, tz: "America/Los_Angeles" },
  { lat: 30.2672, lng: -97.7431, alt: 149, tz: "America/Chicago" },
  { lat: 44.9778, lng: -93.265, alt: 253, tz: "America/Chicago" },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const generateRandomDate = (timezone: string): string => {
  const daysAgo = Math.floor(Math.random() * 60);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const seconds = Math.floor(Math.random() * 60);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, seconds, 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const offsetPart = parts.find((p) => p.type === "timeZoneName");
  const offsetStr = offsetPart?.value?.replace("GMT", "") || "+00:00";
  const offset = offsetStr === "" ? "+00:00" : offsetStr.includes(":") ? offsetStr : `${offsetStr}:00`;

  return date.toISOString().replace("Z", offset);
};

const jitterCoord = (val: number, range: number = 0.01): number => {
  return val + (Math.random() - 0.5) * 2 * range;
};

export const generateJumbledMetadata = (): string[] => {
  const device = pickRandom(DEVICES);
  const location = pickRandom(LOCATIONS);
  const creationTime = generateRandomDate(location.tz);
  const lat = jitterCoord(location.lat);
  const lng = jitterCoord(location.lng);
  const alt = location.alt + Math.floor(Math.random() * 20 - 10);

  const escapeMetaValue = (val: string) => val.replace(/([=;#\\'\n])/g, "\\$1");

  const metadata: string[] = [
    `-metadata:g`, `make=${escapeMetaValue(device.make)}`,
    `-metadata:g`, `model=${escapeMetaValue(device.model)}`,
    `-metadata:g`, `creation_time=${creationTime}`,
    `-metadata:g`, `location=${lat >= 0 ? "+" : ""}${lat.toFixed(4)}${lng >= 0 ? "+" : ""}${lng.toFixed(4)}/`,
    `-metadata:g`, `location-eng=${lat >= 0 ? "+" : ""}${lat.toFixed(4)}${lng >= 0 ? "+" : ""}${lng.toFixed(4)}/`,
  ];

  if (device.software) {
    metadata.push(`-metadata:g`, `software=${escapeMetaValue(device.software)}`);
  }

  if (device.make === "Apple") {
    metadata.push(`-metadata:g`, `com.apple.quicktime.make=${escapeMetaValue(device.make)}`);
    metadata.push(`-metadata:g`, `com.apple.quicktime.model=${escapeMetaValue(device.model)}`);
    if (device.software) {
      metadata.push(`-metadata:g`, `com.apple.quicktime.software=${escapeMetaValue(device.software)}`);
    }
    metadata.push(`-metadata:g`, `com.apple.quicktime.location.ISO6709=${lat >= 0 ? "+" : ""}${lat.toFixed(4)}${lng >= 0 ? "+" : ""}${lng.toFixed(4)}+${alt.toFixed(2)}/`);
    metadata.push("-metadata:s:v:0", "handler_name=Core Media Video");
    metadata.push("-metadata:s:a:0", "handler_name=Core Media Audio");
    metadata.push("-metadata:s:v:0", `encoder=Apple H.264`);
  } else {
    metadata.push("-metadata:s:v:0", "handler_name=VideoHandler");
    metadata.push("-metadata:s:a:0", "handler_name=SoundHandler");
  }

  return metadata;
};

export const generateJumbledMetadataString = (): string => {
  const device = pickRandom(DEVICES);
  const location = pickRandom(LOCATIONS);
  const creationTime = generateRandomDate(location.tz);
  const lat = jitterCoord(location.lat);
  const lng = jitterCoord(location.lng);
  const alt = location.alt + Math.floor(Math.random() * 20 - 10);
  const locationStr = `${lat >= 0 ? "+" : ""}${lat.toFixed(4)}${lng >= 0 ? "+" : ""}${lng.toFixed(4)}/`;
  const isoLocationStr = `${lat >= 0 ? "+" : ""}${lat.toFixed(4)}${lng >= 0 ? "+" : ""}${lng.toFixed(4)}+${alt.toFixed(2)}/`;

  const parts: string[] = [
    `-metadata make="${device.make}"`,
    `-metadata model="${device.model}"`,
    `-metadata creation_time=${creationTime}`,
    `-metadata location="${locationStr}"`,
    `-metadata location-eng="${locationStr}"`,
  ];

  if (device.software) {
    parts.push(`-metadata software=${device.software}`);
  }

  if (device.make === "Apple") {
    parts.push(`-metadata "com.apple.quicktime.make=${device.make}"`);
    parts.push(`-metadata "com.apple.quicktime.model=${device.model}"`);
    if (device.software) {
      parts.push(`-metadata "com.apple.quicktime.software=${device.software}"`);
    }
    parts.push(`-metadata "com.apple.quicktime.location.ISO6709=${isoLocationStr}"`);
    parts.push(`-metadata:s:v:0 handler_name="Core Media Video"`);
    parts.push(`-metadata:s:a:0 handler_name="Core Media Audio"`);
    parts.push(`-metadata:s:v:0 encoder="Apple H.264"`);
  } else {
    parts.push(`-metadata:s:v:0 handler_name=VideoHandler`);
    parts.push(`-metadata:s:a:0 handler_name=SoundHandler`);
  }

  return parts.join(" ");
};

/**
 * Apply jumbled metadata to an existing video file (in-place or to new output)
 * Uses stream copy to avoid re-encoding - fast and quality-preserving
 */
export const applyJumbledMetadata = async (
  inputPath: string,
  outputPath: string
): Promise<void> => {
  const { execSync } = await import("child_process");
  const metadataString = generateJumbledMetadataString();

  const cmd = `ffmpeg -y -i "${inputPath}" -c copy -movflags +faststart ${metadataString} "${outputPath}"`;

  execSync(cmd, { stdio: "pipe" });
};
