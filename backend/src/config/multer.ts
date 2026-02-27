import multer from "multer";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// File filter for videos only
const fileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "video/mp4",
    "video/mpeg",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "video/webm",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only video files (mp4, mov, avi, mkv, webm) are allowed."
      )
    );
  }
};

// Configure multer
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB max file size (increased for large video files)
    fieldSize: 50 * 1024 * 1024, // 50MB max for field values (needed for base64 encoded images)
  },
});

// Image upload config (memory storage for S3 uploads)
const imageFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only image files (jpg, png, gif, webp) are allowed."
      )
    );
  }
};

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max for images
  },
});

const faceSwapFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.fieldname === "video") {
    const allowedVideoMimes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-msvideo",
    ];
    if (allowedVideoMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid video type. Only mp4, mov, webm, avi are allowed."));
    }
  } else if (file.fieldname === "images") {
    const allowedImageMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (allowedImageMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid image type. Only jpg, png, webp are allowed."));
    }
  } else {
    cb(new Error("Unexpected field"));
  }
};

// Audio upload config (memory storage for voice clone uploads)
const audioFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedMimes = [
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only audio files (webm, mp4, mp3, wav, ogg) are allowed."
      )
    );
  }
};

export const audioUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max for audio
  },
});

const apiClipFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.fieldname === "video") {
    const allowedVideoMimes = [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/x-matroska",
      "video/webm",
    ];
    if (allowedVideoMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid video type. Only mp4, mov, avi, mkv, webm are allowed."));
    }
  } else if (file.fieldname === "music") {
    const allowedAudioMimes = [
      "audio/mpeg",
      "audio/wav",
      "audio/aac",
      "audio/mp4",
      "audio/ogg",
    ];
    if (allowedAudioMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid audio type. Only mp3, wav, aac, m4a are allowed."));
    }
  } else {
    cb(new Error("Unexpected field"));
  }
};

export const apiClipUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const prefix = file.fieldname === "video" ? "api-clip-video" : "api-clip-music";
      cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: apiClipFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 * 1024, // 10GB max
    files: 2, // 1 video + 1 music
  },
});

const apiFaceSwapFileFilter = (
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.fieldname === "video") {
    const allowedVideoMimes = [
      "video/mp4",
      "video/quicktime",
      "video/webm",
      "video/x-msvideo",
    ];
    if (allowedVideoMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid video type. Only mp4, mov, webm, avi are allowed."));
    }
  } else if (file.fieldname === "face_image") {
    const allowedImageMimes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (allowedImageMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid image type. Only jpg, png, webp are allowed."));
    }
  } else {
    cb(new Error("Unexpected field"));
  }
};

export const apiFaceSwapUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const prefix = file.fieldname === "video" ? "api-faceswap-video" : "api-faceswap-image";
      cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: apiFaceSwapFileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max per file
    files: 2, // 1 video + 1 face image
  },
});

export const faceSwapUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const prefix = file.fieldname === "video" ? "faceswap-video" : "faceswap-image";
      cb(null, `${prefix}-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: faceSwapFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max per file
    files: 11, // 1 video + up to 10 images
  },
});
