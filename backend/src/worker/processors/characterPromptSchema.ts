import { openaiClient } from "../../services/openai.service";
import { GenerateCharacterJob } from "../../services/sqs.service";

export interface CharacterPromptSchema {
  metadata: {
    confidence_score: string;
    image_type: string;
    primary_purpose: string;
  };
  composition: {
    rule_applied: string;
    aspect_ratio: string;
    layout: string;
    focal_points: string[];
    visual_hierarchy: string;
    balance: string;
  };
  color_profile: {
    dominant_colors: Array<{
      color: string;
      hex: string;
      percentage: string;
      role: string;
    }>;
    color_palette: string;
    temperature: string;
    saturation: string;
    contrast: string;
  };
  lighting: {
    type: string;
    source_count: string;
    direction: string;
    directionality: string;
    quality: string;
    intensity: string;
    contrast_ratio: string;
    mood: string;
    shadows: {
      type: string;
      density: string;
      placement: string;
      length: string;
    };
    highlights: {
      treatment: string;
      placement: string;
    };
    ambient_fill: string;
    light_temperature: string;
  };
  technical_specs: {
    medium: string;
    style: string;
    texture: string;
    sharpness: string;
    grain: string;
    depth_of_field: string;
    perspective: string;
  };
  artistic_elements: {
    genre: string;
    influences: string[];
    mood: string;
    atmosphere: string;
    visual_style: string;
  };
  subject_analysis: {
    primary_subject: string;
    positioning: string;
    scale: string;
    interaction: string;
    facial_expression: {
      mouth: string;
      smile_intensity: string;
      eyes: string;
      eyebrows: string;
      overall_emotion: string;
      authenticity: string;
    };
    skin: {
      tone: string;
      texture: string;
      imperfections: string;
      details: string;
    };
    hair: {
      color: string;
      length: string;
      texture: string;
      texture_quality: string;
      natural_imperfections: string;
      styling: string;
      volume: string;
      details: string;
    };
    eyes: {
      color: string;
      shape: string;
      details: string;
      expression: string;
    };
    body: {
      type: string;
      posture: string;
      clothing: string;
      positioning: string;
    };
    hands_and_arms: {
      visibility: string;
      count: string;
      positioning: string;
      naturalness: string;
    };
  };
  background: {
    setting_type: string;
    spatial_depth: string;
    elements: string[];
    treatment: string;
    lighting_interaction: string;
  };
  realism_markers: {
    skin_details: string[];
    imperfections: string[];
    lighting_effects: string[];
    camera_artifacts: string[];
  };
  negative_elements: string[];
}

const VARIATION_MOODS = [
  {
    mood: "warm and approachable",
    expression: "gentle genuine smile",
    eyes: "soft friendly gaze",
  },
  {
    mood: "confident and calm",
    expression: "neutral slight smile",
    eyes: "direct assured gaze",
  },
  {
    mood: "playful and engaging",
    expression: "bright asymmetric grin",
    eyes: "sparkling with warmth",
  },
  {
    mood: "thoughtful and serene",
    expression: "soft closed-lip smile",
    eyes: "contemplative gentle look",
  },
];

export async function generateCharacterPromptSchema(
  config: GenerateCharacterJob["config"],
  variationIndex: number,
): Promise<CharacterPromptSchema> {
  const variation = VARIATION_MOODS[variationIndex % VARIATION_MOODS.length];

  const outfit =
    config.style.outfit === "other" && config.style.outfitCustom
      ? config.style.outfitCustom
      : config.style.outfit;

  const setting = config.style.setting || "cozy well-lit indoor space";
  const additionalNotes = config.style.anythingElse || "";

  const systemPrompt = `You are an expert photography director and AI image prompt engineer. Generate a highly detailed JSON schema for creating photorealistic portrait photographs using AI image generation.

Your output must be valid JSON matching this exact structure. Every field must be filled with specific, detailed values - no generic placeholders.

CRITICAL REQUIREMENTS:
1. The image must look like a real iPhone photograph of a real person
2. FRAMING: Half-body shot showing head, torso, and waist - NOT just head and shoulders
3. Skin must have visible pores, natural oils, subtle imperfections
4. Eyes must have moisture, natural redness in corners, iris detail
5. Hair must have flyaways, individual strands, natural texture
6. Exactly TWO arms, exactly TWO hands with FIVE fingers each if visible
7. No AI artifacts, no plastic skin, no uncanny valley effects

Output only valid JSON, no markdown, no explanations.`;

  const userPrompt = `Create a detailed JSON prompt schema for this character:
${additionalNotes ? `\n**CRITICAL USER REQUIREMENTS (MUST FOLLOW):** ${additionalNotes}\n` : ""}
SUBJECT:
- Gender: ${config.gender}
- Age Range: ${config.ageRange}
- Skin Tone: ${config.appearance.skinTone}
- Hair Color: ${config.appearance.hairColor}
- Hair Style: ${config.appearance.hairStyle}
- Eye Color: ${config.appearance.eyeColor}
- Body Type: ${config.appearance.bodyType}
${additionalNotes ? `- Special Instructions: ${additionalNotes}` : ""}

STYLE:
- Outfit: ${outfit}
- Setting: ${setting}
- Mood/Expression: ${variation.mood}, ${variation.expression}, ${variation.eyes}

Generate the complete JSON schema with these sections:
- metadata (image type, purpose)
- composition (rule of thirds, focal points, visual hierarchy)
- color_profile (dominant colors with hex codes, temperature, saturation)
- lighting (type, direction, quality, shadows, highlights)
- technical_specs (camera specs, depth of field, grain)
- artistic_elements (genre, mood, atmosphere)
- subject_analysis (detailed face, skin, hair, eyes, body, hands description)
- background (setting details, depth, elements)
- realism_markers (specific skin details, imperfections, camera artifacts to include)
- negative_elements (list of things to avoid: extra limbs, smooth skin, etc.)

Make it hyperspecific for photorealism. Include actual hex color codes. Describe exact skin textures, pore visibility, lighting falloff, camera sensor characteristics.`;

  try {
    const response = await openaiClient.responses.create({
      model: "gpt-5-mini",
      instructions: systemPrompt,
      input: userPrompt,
      reasoning: { effort: "minimal" },
      text: { format: { type: "json_object" } },
    });

    const outputText = response.output_text || "{}";
    const aiSchema = JSON.parse(outputText);
    const fallback = buildFallbackSchema(config, variationIndex);

    return mergeSchemas(fallback, aiSchema);
  } catch (error) {
    console.error("[CharacterSchema] Failed to generate schema:", error);
    return buildFallbackSchema(config, variationIndex);
  }
}

function mergeSchemas(
  fallback: CharacterPromptSchema,
  ai: Partial<CharacterPromptSchema>,
): CharacterPromptSchema {
  return {
    metadata: { ...fallback.metadata, ...ai.metadata },
    composition: { ...fallback.composition, ...ai.composition },
    color_profile: {
      ...fallback.color_profile,
      ...ai.color_profile,
      dominant_colors: ai.color_profile?.dominant_colors?.length
        ? ai.color_profile.dominant_colors
        : fallback.color_profile.dominant_colors,
    },
    lighting: {
      ...fallback.lighting,
      ...ai.lighting,
      shadows: { ...fallback.lighting.shadows, ...ai.lighting?.shadows },
      highlights: {
        ...fallback.lighting.highlights,
        ...ai.lighting?.highlights,
      },
    },
    technical_specs: { ...fallback.technical_specs, ...ai.technical_specs },
    artistic_elements: {
      ...fallback.artistic_elements,
      ...ai.artistic_elements,
      influences: ai.artistic_elements?.influences?.length
        ? ai.artistic_elements.influences
        : fallback.artistic_elements.influences,
    },
    subject_analysis: {
      ...fallback.subject_analysis,
      ...ai.subject_analysis,
      facial_expression: {
        ...fallback.subject_analysis.facial_expression,
        ...ai.subject_analysis?.facial_expression,
      },
      skin: { ...fallback.subject_analysis.skin, ...ai.subject_analysis?.skin },
      hair: { ...fallback.subject_analysis.hair, ...ai.subject_analysis?.hair },
      eyes: { ...fallback.subject_analysis.eyes, ...ai.subject_analysis?.eyes },
      body: { ...fallback.subject_analysis.body, ...ai.subject_analysis?.body },
      hands_and_arms: {
        ...fallback.subject_analysis.hands_and_arms,
        ...ai.subject_analysis?.hands_and_arms,
      },
    },
    background: {
      ...fallback.background,
      ...ai.background,
      elements: ai.background?.elements?.length
        ? ai.background.elements
        : fallback.background.elements,
    },
    realism_markers: {
      skin_details: ai.realism_markers?.skin_details?.length
        ? ai.realism_markers.skin_details
        : fallback.realism_markers.skin_details,
      imperfections: ai.realism_markers?.imperfections?.length
        ? ai.realism_markers.imperfections
        : fallback.realism_markers.imperfections,
      lighting_effects: ai.realism_markers?.lighting_effects?.length
        ? ai.realism_markers.lighting_effects
        : fallback.realism_markers.lighting_effects,
      camera_artifacts: ai.realism_markers?.camera_artifacts?.length
        ? ai.realism_markers.camera_artifacts
        : fallback.realism_markers.camera_artifacts,
    },
    negative_elements: ai.negative_elements?.length
      ? ai.negative_elements
      : fallback.negative_elements,
  };
}

function buildFallbackSchema(
  config: GenerateCharacterJob["config"],
  variationIndex: number,
): CharacterPromptSchema {
  const variation = VARIATION_MOODS[variationIndex % VARIATION_MOODS.length];
  const outfit =
    config.style.outfit === "other" && config.style.outfitCustom
      ? config.style.outfitCustom
      : config.style.outfit;

  return {
    metadata: {
      confidence_score: "high",
      image_type: "photograph",
      primary_purpose: "social media portrait",
    },
    composition: {
      rule_applied: "rule of thirds",
      aspect_ratio: "3:4 vertical",
      layout: "half-body framing showing head, torso, and waist with environmental context",
      focal_points: ["Subject's eyes", "Face", "Upper body", "Outfit"],
      visual_hierarchy:
        "Eyes draw attention first, then face, then torso and outfit, then background",
      balance: "centered subject with subtle asymmetric background elements",
    },
    color_profile: {
      dominant_colors: [
        {
          color: "Skin Tone",
          hex: "#D4A574",
          percentage: "25%",
          role: "primary subject",
        },
        {
          color: "Hair",
          hex: "#4A3728",
          percentage: "15%",
          role: "framing element",
        },
        {
          color: "Background",
          hex: "#E8DFD5",
          percentage: "40%",
          role: "environment",
        },
      ],
      color_palette: "warm naturals",
      temperature: "warm",
      saturation: "moderate natural",
      contrast: "medium",
    },
    lighting: {
      type: "mixed natural and artificial",
      source_count: "primary window light with ambient fill",
      direction: "45 degrees from camera left",
      directionality: "soft diffused",
      quality: "soft flattering light",
      intensity: "moderate",
      contrast_ratio: "medium soft",
      mood: variation.mood,
      shadows: {
        type: "soft gradual edges",
        density: "transparent gray",
        placement: "under jaw, side of nose",
        length: "short soft",
      },
      highlights: {
        treatment: "natural specular on skin",
        placement: "forehead, nose tip, cheekbones, hair crown",
      },
      ambient_fill: "present from reflected surfaces",
      light_temperature: "warm golden main, cooler fill",
    },
    technical_specs: {
      medium: "iPhone 15 Pro front camera",
      style: "authentic UGC selfie",
      texture: "natural with visible detail",
      sharpness: "tack sharp on eyes, natural falloff",
      grain: "subtle ISO 640 sensor noise in shadows",
      depth_of_field: "shallow - f/1.9 portrait mode",
      perspective: "slightly above eye level, 23mm equivalent",
    },
    artistic_elements: {
      genre: "lifestyle portrait",
      influences: ["Instagram authentic", "casual selfie"],
      mood: variation.mood,
      atmosphere: "intimate casual",
      visual_style: "raw authentic UGC",
    },
    subject_analysis: {
      primary_subject: `${config.ageRange} ${config.gender}`,
      positioning: "centered, facing camera",
      scale: "half-body portrait showing head, torso, and waist",
      interaction: "direct eye contact with viewer",
      facial_expression: {
        mouth: variation.expression,
        smile_intensity: "natural authentic",
        eyes: variation.eyes,
        eyebrows: "relaxed natural position",
        overall_emotion: variation.mood,
        authenticity: "genuine unposed",
      },
      skin: {
        tone: config.appearance.skinTone || "medium",
        texture: "natural with visible pores on nose and cheeks",
        imperfections:
          "subtle natural blemishes, slight redness variations, tiny bumps",
        details:
          "visible pores, natural oil shine on T-zone, peach fuzz on cheeks catching light",
      },
      hair: {
        color: config.appearance.hairColor || "brown",
        length: config.appearance.hairStyle?.includes("short")
          ? "short"
          : "medium",
        texture: config.appearance.hairStyle?.includes("curly")
          ? "curly"
          : "straight",
        texture_quality: "natural with individual strands visible",
        natural_imperfections: "flyaways, baby hairs at hairline, slight frizz",
        styling: config.appearance.hairStyle || "natural",
        volume: "natural body",
        details: "individual strands catching light, natural movement",
      },
      eyes: {
        color: config.appearance.eyeColor || "brown",
        shape: "natural almond",
        details:
          "visible iris texture, natural moisture, slight redness in corners, catch lights",
        expression: variation.eyes,
      },
      body: {
        type: config.appearance.bodyType || "average",
        posture: "relaxed natural standing or seated",
        clothing: outfit || "casual",
        positioning: "torso and waist visible, natural stance with arms relaxed at sides",
      },
      hands_and_arms: {
        visibility: "partially visible or cropped",
        count: "exactly two arms, two hands if visible",
        positioning: "natural relaxed position",
        naturalness: "organic casual gesture with five fingers per hand",
      },
    },
    background: {
      setting_type: config.style.setting || "indoor",
      spatial_depth: "shallow with bokeh",
      elements: ["soft blurred environment", "natural lighting sources"],
      treatment: "portrait mode blur",
      lighting_interaction: "soft ambient glow",
    },
    realism_markers: {
      skin_details: [
        "visible pores on nose bridge and cheeks",
        "natural oil shine on forehead",
        "subtle texture variation across face",
        "fine peach fuzz catching sidelight",
      ],
      imperfections: [
        "tiny natural blemishes",
        "slight undereye shadows",
        "natural redness around nose",
        "subtle color variation in skin",
      ],
      lighting_effects: [
        "subsurface scattering on ear edges",
        "specular highlights on nose tip",
        "soft shadow gradients",
        "natural light falloff",
      ],
      camera_artifacts: [
        "subtle ISO noise in shadows",
        "slight vignette at corners",
        "natural lens softness at edges",
        "authentic depth of field falloff",
      ],
    },
    negative_elements: [
      "extra limbs",
      "additional arms",
      "multiple arms",
      "three arms",
      "extra hands",
      "additional hands",
      "three hands",
      "six fingers",
      "deformed hands",
      "mutated fingers",
      "fused fingers",
      "missing fingers",
      "smooth plastic skin",
      "poreless skin",
      "airbrushed texture",
      "beauty filter",
      "skin smoothing",
      "perfect complexion",
      "uncanny valley",
      "CGI look",
      "3D render",
      "illustration",
      "watermark",
      "text overlay",
      "logo",
      "signature",
    ],
  };
}

export function schemaToPrompt(schema: CharacterPromptSchema, userNotes?: string): string {
  const sections: string[] = [];

  if (userNotes) {
    sections.push(`CRITICAL REQUIREMENTS: ${userNotes}`);
  }

  sections.push(
    `A photorealistic ${schema.technical_specs.medium} photograph. Half-body framing showing head, torso, and waist.`,
  );

  sections.push(
    `SUBJECT: ${schema.subject_analysis.primary_subject}, ${schema.subject_analysis.scale}, ${schema.subject_analysis.positioning}. Torso and upper body clearly visible.${userNotes ? ` ${userNotes}.` : ""}`,
  );

  sections.push(
    `FACE: ${schema.subject_analysis.facial_expression.overall_emotion} expression with ${schema.subject_analysis.facial_expression.mouth}. Eyes: ${schema.subject_analysis.eyes.color}, ${schema.subject_analysis.eyes.details}, ${schema.subject_analysis.facial_expression.eyes}.`,
  );

  sections.push(
    `SKIN: ${schema.subject_analysis.skin.tone} tone. ${schema.subject_analysis.skin.details}. ${schema.subject_analysis.skin.imperfections}.`,
  );

  sections.push(
    `HAIR: ${schema.subject_analysis.hair.color} ${schema.subject_analysis.hair.texture} hair, ${schema.subject_analysis.hair.length}. ${schema.subject_analysis.hair.natural_imperfections}. ${schema.subject_analysis.hair.details}.`,
  );

  sections.push(
    `BODY: ${schema.subject_analysis.body.type} build, ${schema.subject_analysis.body.posture}. Wearing ${schema.subject_analysis.body.clothing}. Full torso visible from chest to waist, outfit clearly shown.`,
  );

  sections.push(
    `HANDS: ${schema.subject_analysis.hands_and_arms.visibility}. ${schema.subject_analysis.hands_and_arms.count}. ${schema.subject_analysis.hands_and_arms.naturalness}.`,
  );

  sections.push(
    `COMPOSITION: ${schema.composition.rule_applied}, ${schema.composition.aspect_ratio}. ${schema.composition.visual_hierarchy}.`,
  );

  sections.push(
    `LIGHTING: ${schema.lighting.type}, ${schema.lighting.direction}. ${schema.lighting.quality}, ${schema.lighting.intensity}. Shadows: ${schema.lighting.shadows.type}, ${schema.lighting.shadows.placement}. Highlights: ${schema.lighting.highlights.placement}.`,
  );

  sections.push(
    `CAMERA: ${schema.technical_specs.medium}. ${schema.technical_specs.depth_of_field}. ${schema.technical_specs.sharpness}. ${schema.technical_specs.grain}.`,
  );

  sections.push(
    `BACKGROUND: ${schema.background.setting_type}. ${schema.background.treatment}. ${schema.background.spatial_depth}.`,
  );

  sections.push(
    `REALISM: ${schema.realism_markers.skin_details.join(", ")}. ${schema.realism_markers.imperfections.join(", ")}. ${schema.realism_markers.camera_artifacts.join(", ")}.`,
  );

  sections.push(`NEGATIVE: ${schema.negative_elements.join(", ")}.`);

  return sections.join("\n\n");
}

export function schemaToVariationPrompt(
  schema: CharacterPromptSchema,
  userChanges: string,
): string {
  const sections: string[] = [];

  sections.push(
    `Photograph of the EXACT SAME person from reference images in a new pose.`,
  );

  sections.push(
    `PRESERVE IDENTITY: Same face, bone structure, ${schema.subject_analysis.skin.tone} skin, ${schema.subject_analysis.hair.color} ${schema.subject_analysis.hair.texture} hair, ${schema.subject_analysis.eyes.color} eyes. Keep all distinguishing features identical.`,
  );

  sections.push(`REQUESTED CHANGES: ${userChanges}`);

  sections.push(
    `EXPRESSION: ${schema.subject_analysis.facial_expression.overall_emotion}, ${schema.subject_analysis.facial_expression.mouth}, ${schema.subject_analysis.facial_expression.eyes}.`,
  );

  sections.push(
    `SKIN REALISM: ${schema.subject_analysis.skin.details}. ${schema.realism_markers.skin_details.join(", ")}.`,
  );

  sections.push(
    `CAMERA: ${schema.technical_specs.medium}. ${schema.technical_specs.depth_of_field}. ${schema.technical_specs.grain}.`,
  );

  sections.push(
    `ANATOMY: Exactly two arms, exactly two hands with five fingers each if visible. Natural human proportions.`,
  );

  sections.push(
    `NEGATIVE: ${schema.negative_elements.join(", ")}, changing identity, different face, different hair color, changing skin tone, changing ethnicity.`,
  );

  return sections.join("\n\n");
}
