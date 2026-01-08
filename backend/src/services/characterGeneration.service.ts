export interface AppearanceConfig {
  hairColor: string;
  hairStyle: string;
  skinTone: string;
  eyeColor: string;
  bodyType: string;
}

export interface StyleConfig {
  outfit: string;
  outfitCustom?: string;
  setting: string;
  cameraStyle: string;
  anythingElse?: string;
}

export interface CharacterConfig {
  gender: string;
  ageRange: string;
  appearance: AppearanceConfig;
  style: StyleConfig;
  referenceImages?: string[];
}
