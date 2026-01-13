const IPHONE_DEVICES = [
  {
    model: "iPhone 16 Pro Max",
    lenses: [
      { lens: "iPhone 16 Pro Max back triple camera 6.765mm f/1.78", focalLength: "24" },
      { lens: "iPhone 16 Pro Max back triple camera 2.22mm f/2.2", focalLength: "13" },
      { lens: "iPhone 16 Pro Max back triple camera 16.32mm f/2.8", focalLength: "120" },
    ],
  },
  {
    model: "iPhone 16 Pro",
    lenses: [
      { lens: "iPhone 16 Pro back triple camera 6.765mm f/1.78", focalLength: "24" },
      { lens: "iPhone 16 Pro back triple camera 2.22mm f/2.2", focalLength: "13" },
      { lens: "iPhone 16 Pro back triple camera 16.32mm f/2.8", focalLength: "120" },
    ],
  },
  {
    model: "iPhone 16 Plus",
    lenses: [
      { lens: "iPhone 16 Plus back dual camera 6.765mm f/1.6", focalLength: "26" },
      { lens: "iPhone 16 Plus back dual camera 2.22mm f/2.2", focalLength: "13" },
    ],
  },
  {
    model: "iPhone 16",
    lenses: [
      { lens: "iPhone 16 back dual camera 6.765mm f/1.6", focalLength: "26" },
      { lens: "iPhone 16 back dual camera 2.22mm f/2.2", focalLength: "13" },
    ],
  },
  {
    model: "iPhone 15 Pro Max",
    lenses: [
      { lens: "iPhone 15 Pro Max back triple camera 6.765mm f/1.78", focalLength: "24" },
      { lens: "iPhone 15 Pro Max back triple camera 2.22mm f/2.2", focalLength: "13" },
      { lens: "iPhone 15 Pro Max back triple camera 16.32mm f/2.8", focalLength: "120" },
    ],
  },
  {
    model: "iPhone 15 Pro",
    lenses: [
      { lens: "iPhone 15 Pro back triple camera 6.765mm f/1.78", focalLength: "24" },
      { lens: "iPhone 15 Pro back triple camera 2.22mm f/2.2", focalLength: "13" },
      { lens: "iPhone 15 Pro back triple camera 9.03mm f/2.8", focalLength: "77" },
    ],
  },
  {
    model: "iPhone 15 Plus",
    lenses: [
      { lens: "iPhone 15 Plus back dual camera 6.86mm f/1.6", focalLength: "26" },
      { lens: "iPhone 15 Plus back dual camera 2.22mm f/2.4", focalLength: "13" },
    ],
  },
  {
    model: "iPhone 15",
    lenses: [
      { lens: "iPhone 15 back dual camera 6.86mm f/1.6", focalLength: "26" },
      { lens: "iPhone 15 back dual camera 2.22mm f/2.4", focalLength: "13" },
    ],
  },
  {
    model: "iPhone 14 Pro Max",
    lenses: [
      { lens: "iPhone 14 Pro Max back triple camera 6.86mm f/1.78", focalLength: "24" },
      { lens: "iPhone 14 Pro Max back triple camera 2.22mm f/2.2", focalLength: "13" },
      { lens: "iPhone 14 Pro Max back triple camera 9.03mm f/2.8", focalLength: "77" },
    ],
  },
  {
    model: "iPhone 14 Pro",
    lenses: [
      { lens: "iPhone 14 Pro back triple camera 6.86mm f/1.78", focalLength: "24" },
      { lens: "iPhone 14 Pro back triple camera 2.22mm f/2.2", focalLength: "13" },
      { lens: "iPhone 14 Pro back triple camera 9.03mm f/2.8", focalLength: "77" },
    ],
  },
  {
    model: "iPhone 14 Plus",
    lenses: [
      { lens: "iPhone 14 Plus back dual camera 5.7mm f/1.5", focalLength: "26" },
      { lens: "iPhone 14 Plus back dual camera 2.22mm f/2.4", focalLength: "13" },
    ],
  },
  {
    model: "iPhone 14",
    lenses: [
      { lens: "iPhone 14 back dual camera 5.7mm f/1.5", focalLength: "26" },
      { lens: "iPhone 14 back dual camera 2.22mm f/2.4", focalLength: "13" },
    ],
  },
  {
    model: "iPhone 13 Pro Max",
    lenses: [
      { lens: "iPhone 13 Pro Max back triple camera 5.7mm f/1.5", focalLength: "26" },
      { lens: "iPhone 13 Pro Max back triple camera 1.57mm f/1.8", focalLength: "13" },
      { lens: "iPhone 13 Pro Max back triple camera 9.03mm f/2.8", focalLength: "77" },
    ],
  },
  {
    model: "iPhone 13 Pro",
    lenses: [
      { lens: "iPhone 13 Pro back triple camera 5.7mm f/1.5", focalLength: "26" },
      { lens: "iPhone 13 Pro back triple camera 1.57mm f/1.8", focalLength: "13" },
      { lens: "iPhone 13 Pro back triple camera 9.03mm f/2.8", focalLength: "77" },
    ],
  },
  {
    model: "iPhone 13",
    lenses: [
      { lens: "iPhone 13 back dual camera 5.1mm f/1.6", focalLength: "26" },
      { lens: "iPhone 13 back dual camera 1.55mm f/2.4", focalLength: "13" },
    ],
  },
  {
    model: "iPhone 13 mini",
    lenses: [
      { lens: "iPhone 13 mini back dual camera 5.1mm f/1.6", focalLength: "26" },
      { lens: "iPhone 13 mini back dual camera 1.55mm f/2.4", focalLength: "13" },
    ],
  },
];

const IOS_VERSIONS = [
  "18.2", "18.1.1", "18.1", "18.0.1", "18.0",
  "17.7.2", "17.7.1", "17.6.1", "17.5.1", "17.4.1",
];

const EXPOSURE_MODES = [0, 0, 0, 0, 1];
const WHITE_BALANCE_MODES = [0, 0, 0, 0, 1];

const OTHER_DEVICES = [
  { make: "samsung", model: "SM-S928U" },
  { make: "samsung", model: "SM-S926U" },
  { make: "samsung", model: "SM-S921U" },
  { make: "samsung", model: "SM-S918U" },
  { make: "samsung", model: "SM-F956U" },
  { make: "samsung", model: "SM-F741U" },
  { make: "Google", model: "Pixel 9 Pro XL" },
  { make: "Google", model: "Pixel 9 Pro" },
  { make: "Google", model: "Pixel 9" },
  { make: "Google", model: "Pixel 8 Pro" },
  { make: "Google", model: "Pixel 8" },
  { make: "OnePlus", model: "CPH2649" },
  { make: "OnePlus", model: "CPH2581" },
  { make: "Xiaomi", model: "2402APD6CI" },
];

const generateRandomDate = (): string => {
  const daysAgo = Math.random() * 60;
  const hoursOffset = Math.random() * 24;
  const minutesOffset = Math.random() * 60;
  const secondsOffset = Math.random() * 60;
  const timestamp = Date.now() - (daysAgo * 86400000) - (hoursOffset * 3600000) - (minutesOffset * 60000) - (secondsOffset * 1000);
  return new Date(timestamp).toISOString();
};

const generateRandomId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 8) + Date.now().toString(36);
};

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16).toUpperCase();
  });
};

const generateContentIdentifier = (): string => {
  return `${generateUUID()}/${generateUUID()}`;
};

const generateIPhoneMetadata = () => {
  const device = IPHONE_DEVICES[Math.floor(Math.random() * IPHONE_DEVICES.length)];
  const lensInfo = device.lenses[Math.floor(Math.random() * device.lenses.length)];
  const software = IOS_VERSIONS[Math.floor(Math.random() * IOS_VERSIONS.length)];
  const exposureMode = EXPOSURE_MODES[Math.floor(Math.random() * EXPOSURE_MODES.length)];
  const whiteBalanceMode = WHITE_BALANCE_MODES[Math.floor(Math.random() * WHITE_BALANCE_MODES.length)];

  return {
    make: "Apple",
    model: device.model,
    software,
    lensModel: lensInfo.lens,
    focalLength: lensInfo.focalLength,
    exposureMode,
    whiteBalanceMode,
    contentIdentifier: generateContentIdentifier(),
    handlerVideo: "Core Media Video",
    handlerAudio: "Core Media Audio",
    brand: "qt  ",
  };
};

const generateOtherDeviceMetadata = () => {
  const device = OTHER_DEVICES[Math.floor(Math.random() * OTHER_DEVICES.length)];

  return {
    make: device.make,
    model: device.model,
    software: "",
    lensModel: "",
    focalLength: "",
    exposureMode: "",
    whiteBalanceMode: "",
    contentIdentifier: "",
    handlerVideo: "VideoHandler",
    handlerAudio: "SoundHandler",
    brand: "isom",
  };
};

export const generateJumbledMetadata = (): string[] => {
  const useIPhone = Math.random() < 0.85;
  const device = useIPhone ? generateIPhoneMetadata() : generateOtherDeviceMetadata();
  const creationTime = generateRandomDate();
  const uniqueId = generateRandomId();

  const metadata = [
    `-metadata`, `make=${device.make}`,
    `-metadata`, `model=${device.model}`,
    `-metadata`, `software=${device.software}`,
    `-metadata`, `creation_time=${creationTime}`,
    `-metadata`, `comment=${uniqueId}`,
    `-metadata`, `title=`,
    `-metadata`, `artist=`,
    `-metadata`, `album=`,
    `-metadata`, `description=`,
    `-metadata`, `copyright=`,
    `-metadata`, `author=`,
    `-metadata`, `encoder=`,
    `-metadata:s:v:0`, `handler_name=${device.handlerVideo}`,
    `-metadata:s:a:0`, `handler_name=${device.handlerAudio}`,
    `-brand`, device.brand,
  ];

  if (device.lensModel) {
    metadata.push(`-metadata`, `com.apple.quicktime.camera.lens_model=${device.lensModel}`);
    metadata.push(`-metadata`, `com.apple.quicktime.camera.focal_length.35mm_equivalent=${device.focalLength}`);
    metadata.push(`-metadata`, `com.apple.quicktime.camera.exposure_mode=${device.exposureMode}`);
    metadata.push(`-metadata`, `com.apple.quicktime.camera.white_balance_mode=${device.whiteBalanceMode}`);
    metadata.push(`-metadata`, `com.apple.quicktime.content.identifier=${device.contentIdentifier}`);
  }

  return metadata;
};

export const generateJumbledMetadataString = (): string => {
  const useIPhone = Math.random() < 0.85;
  const device = useIPhone ? generateIPhoneMetadata() : generateOtherDeviceMetadata();
  const creationTime = generateRandomDate();
  const uniqueId = generateRandomId();

  const parts = [
    `-metadata make="${device.make}"`,
    `-metadata model="${device.model}"`,
    `-metadata software="${device.software}"`,
    `-metadata creation_time="${creationTime}"`,
    `-metadata comment="${uniqueId}"`,
    `-metadata title=""`,
    `-metadata artist=""`,
    `-metadata album=""`,
    `-metadata description=""`,
    `-metadata copyright=""`,
    `-metadata author=""`,
    `-metadata encoder=""`,
    `-metadata:s:v:0 handler_name="${device.handlerVideo}"`,
    `-metadata:s:a:0 handler_name="${device.handlerAudio}"`,
    `-brand ${device.brand}`,
  ];

  if (device.lensModel) {
    parts.push(`-metadata "com.apple.quicktime.camera.lens_model=${device.lensModel}"`);
    parts.push(`-metadata "com.apple.quicktime.camera.focal_length.35mm_equivalent=${device.focalLength}"`);
    parts.push(`-metadata "com.apple.quicktime.camera.exposure_mode=${device.exposureMode}"`);
    parts.push(`-metadata "com.apple.quicktime.camera.white_balance_mode=${device.whiteBalanceMode}"`);
    parts.push(`-metadata "com.apple.quicktime.content.identifier=${device.contentIdentifier}"`);
  }

  return parts.join(" ");
};
