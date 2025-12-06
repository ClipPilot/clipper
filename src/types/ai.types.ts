export interface ClipSegment {
  start: number;
  end: number;
  text: string;
}

export interface ClipSuggestions {
  hook: ClipSegment;
  main: ClipSegment;
  combined_script: string;
}