const DEVICES = [
  { make: "Apple", model: "iPhone 16 Pro Max", software: "18.2" },
  { make: "Apple", model: "iPhone 16 Pro", software: "18.2" },
  { make: "Apple", model: "iPhone 16 Plus", software: "18.1.1" },
  { make: "Apple", model: "iPhone 16", software: "18.1" },
  { make: "Apple", model: "iPhone 15 Pro Max", software: "18.2" },
  { make: "Apple", model: "iPhone 15 Pro", software: "17.7.2" },
  { make: "Apple", model: "iPhone 15 Plus", software: "17.6.1" },
  { make: "Apple", model: "iPhone 15", software: "17.5.1" },
  { make: "Apple", model: "iPhone 14 Pro Max", software: "18.1" },
  { make: "Apple", model: "iPhone 14 Pro", software: "17.7.1" },
  { make: "Apple", model: "iPhone 14 Plus", software: "17.4.1" },
  { make: "Apple", model: "iPhone 14", software: "18.0" },
  { make: "Apple", model: "iPhone 13 Pro Max", software: "17.6.1" },
  { make: "Apple", model: "iPhone 13 Pro", software: "17.5.1" },
  { make: "Apple", model: "iPhone 13", software: "18.1" },
  { make: "samsung", model: "SM-S928U", software: "" },
  { make: "samsung", model: "SM-S926U", software: "" },
  { make: "samsung", model: "SM-S921U", software: "" },
  { make: "samsung", model: "SM-S918U", software: "" },
  { make: "Google", model: "Pixel 9 Pro XL", software: "" },
  { make: "Google", model: "Pixel 9 Pro", software: "" },
  { make: "Google", model: "Pixel 9", software: "" },
  { make: "Google", model: "Pixel 8 Pro", software: "" },
  { make: "Google", model: "Pixel 8", software: "" },
];

const generateRandomDate = (): string => {
  const daysAgo = Math.floor(Math.random() * 60);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const seconds = Math.floor(Math.random() * 60);
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hours, minutes, seconds, 0);
  return date.toISOString().replace("Z", "+00:00");
};

export const generateJumbledMetadata = (): string[] => {
  const device = DEVICES[Math.floor(Math.random() * DEVICES.length)];
  const creationTime = generateRandomDate();

  const metadata: string[] = [
    "-metadata", `make=${device.make}`,
    "-metadata", `model=${device.model}`,
    "-metadata", `creation_time=${creationTime}`,
  ];

  if (device.software) {
    metadata.push("-metadata", `software=${device.software}`);
  }

  if (device.make === "Apple") {
    metadata.push("-metadata:s:v:0", "handler_name=Core Media Video");
    metadata.push("-metadata:s:a:0", "handler_name=Core Media Audio");
  } else {
    metadata.push("-metadata:s:v:0", "handler_name=VideoHandler");
    metadata.push("-metadata:s:a:0", "handler_name=SoundHandler");
  }

  return metadata;
};

export const generateJumbledMetadataString = (): string => {
  return generateJumbledMetadata().join(" ");
};
