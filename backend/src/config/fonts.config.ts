export interface FontConfig {
  url?: string;
  family: string;
  localFile?: string;
}

export const FONT_CONFIG: Record<string, FontConfig> = {
  "Luckiest Guy": {
    url: "https://fonts.googleapis.com/css2?family=Luckiest+Guy&display=swap",
    family: "'Luckiest Guy', cursive",
  },
  Montserrat: {
    url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap",
    family: "'Montserrat', sans-serif",
  },
  "Bebas Neue": {
    url: "https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap",
    family: "'Bebas Neue', sans-serif",
  },
  Anton: {
    url: "https://fonts.googleapis.com/css2?family=Anton&display=swap",
    family: "'Anton', sans-serif",
  },
  Everlasting: {
    family: "'Everlasting', cursive",
    localFile: "Everlasting.ttf",
  },
  Komika: {
    family: "'Komika', sans-serif",
    localFile: "Komika.ttf",
  },
  Burbank: {
    family: "'Burbank', sans-serif",
    localFile: "Burbank.otf",
  },
  "Proxima Nova": {
    family: "'Proxima Nova', sans-serif",
    localFile: "ProximaNova-Semibold.ttf",
  },
};

export const EMOJI_FONT = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji'";
