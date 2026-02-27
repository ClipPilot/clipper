import type { GraphicType } from "./graphics.service";

export type StylePreset = "tile-ad" | "collage" | "photoshoot" | "flat-lay" | "ugc" | "minimalist";

export interface StylePresetConfig {
  name: string;
  description: string;
  icon: string;
}

export const STYLE_PRESETS: Record<StylePreset, StylePresetConfig> = {
  "tile-ad": {
    name: "Art Director",
    description: "2D/3D fusion tile ads with brand simulation and typography",
    icon: "solar:layers-bold-duotone",
  },
  collage: {
    name: "Collage",
    description: "Mixed media layered photos and cutout elements",
    icon: "solar:gallery-bold-duotone",
  },
  photoshoot: {
    name: "Photoshoot",
    description: "Luxury campaign photography, no text",
    icon: "solar:camera-bold-duotone",
  },
  "flat-lay": {
    name: "Flat Lay",
    description: "Top-down product arrangement on styled surface",
    icon: "solar:box-bold-duotone",
  },
  ugc: {
    name: "UGC / Lo-fi",
    description: "Organic, authentic content that blends into the feed",
    icon: "solar:smartphone-bold-duotone",
  },
  minimalist: {
    name: "Minimalist",
    description: "Ultra clean design with maximum white space",
    icon: "solar:minimize-square-bold-duotone",
  },
};

const PLATFORM_CONTEXT: Record<GraphicType, string> = {
  "instagram-ad":
    "Format: Instagram advertisement. Optimized for feed and stories — bold, scroll-stopping, mobile-first composition.",
  "facebook-ad":
    "Format: Facebook advertisement. Optimized for feed conversions — trustworthy, clear value proposition, thumb-stopping.",
  "product-showcase":
    "Format: Product showcase. Product is the absolute hero — e-commerce ready, studio-quality presentation.",
  "banner-display-ad":
    "Format: Display/banner advertisement. Must read at all sizes — efficient layout, clear hierarchy, conversion-focused.",
  custom:
    "Format: General-purpose marketing graphic. Flexible layout for any platform or use case.",
};

const REF_INSTRUCTION =
  "CRITICAL: Reference images are provided. Use them as the primary visual basis. Maintain the same subject, product, colors, and composition. The user's request describes modifications — do NOT ignore the references or generate unrelated content.\n\n";

const STYLE_PROMPTS: Record<StylePreset, { clean: string; bold: string }> = {
  "tile-ad": {
    clean: `Act as a Senior Art Director creating a premium advertisement.

COMPOSITION & OVERLAP: Seamless fusion of 2D graphic design and 3D product photography. The subject or product must physically overlap and break the boundary between graphic panels and photographic elements, creating depth. Geometric shapes from the graphic side bleed into the photographic background area.

BRAND & CATEGORY SIMULATION: Autonomously analyze the brand/product and its industry. Automotive: include vehicle with person interacting. Tech: flagship devices, minimalist grids. Fashion/Lifestyle: editorial poses, premium accessories. Food/Beverage: warm tones, appetite appeal. Match shapes to brand identity. Use the brand's primary signature hue for graphic patterns and subject styling.

TYPOGRAPHY & CONTENT: If headline text is provided, display it in a bold modern Sans-Serif with 3D depth, sitting partially behind the subject or product. Sub-headline below. CTA as a minimalist pill-shaped button. Text layers must have dimensional depth — integrated into the scene, not floating. If no text is provided, leave clean negative space for text placement.

PHOTOGRAPHY & SUBJECT: Clean, bright studio lighting with slight low-angle perspective. Subject is a diverse persona reflecting the brand's audience. Clear blue sky or neutral gradient backdrop. Subject's styling incorporates the brand's primary color.

FINAL STYLE: Clean, refined, premium. Muted sophisticated palette with one signature accent. Crisp, photorealistic fusion of flat vector art and realistic photography. Understated, elegant, commercially polished. Never illustrated or cartoonish.`,

    bold: `Act as a Senior Art Director creating a high-impact advertisement.

COMPOSITION & OVERLAP: Dramatic fusion of bold 2D graphics and cinematic 3D photography. The subject or product smashes through the graphic panel — dynamic overlap creating tension and movement. Angular geometric shapes bleed aggressively across the full frame. Split-composition with graphic panel on one side, photographic on the other.

BRAND & CATEGORY SIMULATION: Analyze the brand/product and push its visual language to the most dramatic expression. Automotive: speed blur, chrome reflections. Tech: neon accents against dark substrates. Fashion: avant-garde editorial poses. One striking brand accent color against a dark or contrasting background.

TYPOGRAPHY & CONTENT: Bold, oversized headline text with 3D extrusion and dramatic shadow. Text layers sit partially behind the subject creating cinematic depth. Strong typographic hierarchy. CTA as a bold pill button in the accent color. Text feels architectural — part of the scene.

PHOTOGRAPHY & SUBJECT: Extreme low-angle (worm's eye view) looking up at the subject. Dramatic single-source lighting with deep shadows. Cinematic color grading. Subject commands the frame. Dark moody environment with the accent color cutting through.

FINAL STYLE: High-impact, editorial, cinematic. One dominant accent color against dark contrast. Crisp, saturated, professional. Bold but never chaotic — every element is intentional.`,
  },

  collage: {
    clean: `Act as a Senior Art Director creating a sophisticated collage-style advertisement.

COMPOSITION: Multi-layered collage of overlapping photographs, graphic elements, and cutout imagery. Arrange product shots, lifestyle images, and brand elements in an intentional grid with organic overlap. Frames within frames — some images with clean borders, others with torn or cut edges. The composition feels curated, like a premium editorial mood board.

LAYERING & TEXTURE: Mix photographic layers with flat graphic elements — color blocks, paper textures, subtle grain. Use drop shadows between layers to create physical depth, as if elements are stacked on a surface. Some elements rotated slightly for dynamic energy. Stickers, stamps, or badge-like accents where appropriate.

BRAND INTEGRATION: Weave the brand's color palette throughout as accent colors on graphic elements, borders, and backgrounds. Product photography should feel naturally integrated, not pasted on. If lifestyle imagery is included, it should reflect the brand's audience and aspirational world.

TYPOGRAPHY: If text is provided, use a mix of typefaces — a bold display font for headlines, a clean sans-serif for body. Text can appear on colored label strips, inside graphic frames, or as large background elements partially obscured by photo layers. Handwritten or script accents for personality.

FINAL STYLE: Curated, editorial, intentionally imperfect. Think high-end fashion magazine collage or premium brand lookbook. Every overlap and angle feels deliberate. Warm, inviting color palette. Photorealistic source imagery, never illustrated subjects.`,

    bold: `Act as a Senior Art Director creating a bold, high-energy collage-style advertisement.

COMPOSITION: Explosive multi-layered collage with dramatic overlapping imagery. Large hero photograph dominates with smaller cutout elements, graphic shapes, and brand imagery layered aggressively around it. Torn edges, sharp angles, and dynamic rotation create urgency. Maximum visual density without chaos — every element earns its place.

LAYERING & TEXTURE: Heavy layering with strong contrast between elements. Black and white photos mixed with full-color, film grain meets sharp digital. Bold color blocks and geometric shapes slice through the composition. High contrast drop shadows, visible tape or pin elements, raw edges.

BRAND INTEGRATION: Brand's signature color used as a dominant accent — on bold graphic shapes, text highlights, and frame elements. Product imagery is punchy and prominent. Lifestyle photography has editorial edge — dramatic angles, bold poses, strong attitude.

TYPOGRAPHY: Oversized, bold display type — headline fills significant frame space. Text can be cropped, overlapped, or partially hidden behind photo layers. Mix of weights creates hierarchy through scale. Type feels like a design element, not just information.

FINAL STYLE: High-energy, editorial, fashion-forward. Think Supreme lookbook meets Dazed magazine. Raw but intentional. Bold contrast, saturated colors, maximalist but curated. Photorealistic source imagery with graphic design intensity.`,
  },

  photoshoot: {
    clean: `Act as a Senior Fashion Photographer directing a luxury brand campaign shoot. ABSOLUTELY NO TEXT, NO TYPOGRAPHY, NO LOGOS, NO GRAPHIC OVERLAYS of any kind.

SCENE & ENVIRONMENT: Aspirational real-world location or premium studio set. Rooftop at golden hour, marble interior, sun-drenched Mediterranean terrace, sleek modern loft, lush botanical garden, or pristine beach. The environment tells the brand story through context alone — no signs, no labels.

MODEL & STYLING: Beautiful, diverse model styled head-to-toe for the brand's world. Wardrobe reflects the brand's aesthetic — luxury fabrics, intentional color palette, statement pieces or understated elegance depending on the brand. Hair and makeup are polished and editorial. Natural, confident body language — candid moments, mid-movement, or composed power poses. The model looks like they belong in this world.

LIGHTING & CAMERA: Natural light as primary source — golden hour, open shade, window light, or overcast softbox sky. Subtle fill or reflector. Shot on a high-end full-frame camera with a fast prime lens (85mm f/1.4 or 50mm f/1.2). Shallow depth of field with creamy bokeh separating subject from background. Slight film-like color grading — warm highlights, soft shadows.

PRODUCT INTEGRATION: If a product is present, the model interacts with it naturally — wearing it, holding it casually, using it in context. The product is visible but never forced. It's part of the lifestyle, not a packaged display.

FINAL STYLE: Pure photography. Zero text, zero graphics, zero overlays. Think Dior, Celine, or Aritzia campaign — effortless luxury captured in a single frame. The image sells through aspiration alone. Photorealistic, magazine-quality, could run as a full-page spread with no modifications.`,

    bold: `Act as a Senior Fashion Photographer directing a high-impact luxury campaign. ABSOLUTELY NO TEXT, NO TYPOGRAPHY, NO LOGOS, NO GRAPHIC OVERLAYS of any kind.

SCENE & ENVIRONMENT: Dramatic, cinematic location or conceptual studio set. Neon-lit urban night, rain-slicked streets, brutalist architecture, desert at dusk, industrial warehouse with theatrical lighting, or surreal minimalist void. The environment creates mood and tension — dark, moody, atmospheric.

MODEL & STYLING: Striking model with bold, avant-garde styling. High-fashion wardrobe — sculptural pieces, dramatic silhouettes, statement outerwear, or haute couture. Bold makeup — graphic liner, strong lip, editorial contouring. Hair is either immaculately styled or intentionally wild. Poses are powerful, angular, commanding — the model owns the frame. Eye contact with camera or dramatic profile.

LIGHTING & CAMERA: Dramatic single-source or mixed lighting. Hard key light with deep shadows sculpting the face and body. Rim lighting or colored gels for mood. Shot on medium format or full-frame with cinematic lens — 85mm or 135mm. Wide aperture for selective focus. Color grading is moody — crushed blacks, desaturated midtones, punchy highlights. Film grain optional.

PRODUCT INTEGRATION: Product is prominently featured but never displayed like an ad — it's part of the model's persona. Worn boldly, held with attitude, or central to the pose. The product feels like it belongs to someone powerful.

FINAL STYLE: Pure photography, zero text, zero graphics. Think Tom Ford, Saint Laurent, or Balenciaga night campaign. Cinematic, provocative, luxurious. Every frame is a statement. The image creates desire through raw visual impact alone. Gallery-quality, full-bleed, no modifications needed.`,
  },

  "flat-lay": {
    clean: `Act as a Senior Product Photographer creating a premium flat lay composition. Camera is DIRECTLY OVERHEAD — perfect bird's eye view, 90-degree top-down angle.

ARRANGEMENT: Intentional, grid-adjacent layout of products and props on a styled surface. Items arranged with mathematical precision — parallel edges, consistent spacing, satisfying symmetry. Mix the hero product with complementary lifestyle props (coffee cup, sunglasses, notebook, botanicals, fabric swatches). Every object is placed with purpose. Negative space between items is part of the composition.

SURFACE & BACKDROP: Clean, textured surface — white marble, light wood, linen fabric, concrete, or terrazzo. The surface adds warmth and material interest without competing. Single surface only — no mixed backgrounds or visible edges. Surface fills the entire frame.

PRODUCT STYLING: Hero product is centrally placed or at a golden-ratio anchor point, slightly larger or more prominent than supporting props. Props reflect the brand's lifestyle and color palette. If beauty: skincare bottles, dried flowers, cotton pads. If tech: cables, minimal desk accessories. If food: ingredients, utensils, herbs, cutting boards. All items are pristine — no clutter, no mess.

LIGHTING: Soft, even, shadowless overhead lighting — or gentle directional light creating subtle, parallel shadows. No harsh contrasts. Colors are true-to-life and vibrant. Everything is evenly exposed.

FINAL STYLE: Clean, curated, Instagram-native. Think Aesop, Goop, or premium DTC brand social content. Every object could be purchased. The composition feels aspirational but attainable. Photorealistic, never illustrated. No text unless specified.`,

    bold: `Act as a Senior Product Photographer creating a bold, maximalist flat lay composition. Camera is DIRECTLY OVERHEAD — perfect bird's eye view, 90-degree top-down angle.

ARRANGEMENT: Dense, abundant arrangement overflowing with product and lifestyle props. Controlled chaos — items overlap, spill out of containers, cascade across the frame. The abundance feels generous and luxurious, not messy. Diagonal lines and organic clustering create visual energy. Frame is 80-90% filled with objects.

SURFACE & BACKDROP: Rich, dramatic surface — dark marble, deep wood grain, black slate, jewel-toned velvet, or bold colored paper. The surface provides contrast against the products. Bold color choice that complements the brand palette.

PRODUCT STYLING: Hero product surrounded by an abundance of complementary items — multiple colorways, related accessories, lifestyle objects, textures and materials. If beauty: scattered petals, broken pigments, dripping textures. If food: overflowing ingredients, sauces, dramatic garnishes. If fashion: layered fabrics, jewelry spilling from boxes, stacked accessories. Maximum visual richness.

LIGHTING: Dramatic directional light creating defined shadows across the objects. Shadows add depth and dimension to the overhead view. Warm, saturated color temperature. High contrast between lit surfaces and shadow areas.

FINAL STYLE: Rich, abundant, visually overwhelming in the best way. Think a luxury brand unboxing or a Bon Appetit ingredient spread. Every inch of the frame rewards attention. Photorealistic, never illustrated. No text unless specified.`,
  },

  ugc: {
    clean: `Create a photo that looks like authentic user-generated content shot on an iPhone. This should NOT look like a professional ad — it should look like a real person's social media post. NO graphic design elements, NO text overlays, NO logos.

CAMERA & QUALITY: Shot on a smartphone. Slightly imperfect — minor lens softness, natural phone camera depth of field, subtle digital noise in shadows. Not blurry or bad quality, just clearly not a DSLR. Vertical orientation preferred (9:16 or 4:5). Natural, unedited white balance.

SCENE & SETTING: Real, relatable environment — bedroom mirror selfie, kitchen counter, car dashboard, coffee shop table, gym, walking outside, bathroom vanity. The location should feel lived-in and authentic. No studio, no seamless backdrops. Background clutter is OK and adds authenticity — but not dirty or messy.

SUBJECT & INTERACTION: Real-looking person (not a model) naturally interacting with the product. Holding it up to camera, applying it, wearing it casually, mid-use. Expression is genuine — a natural smile, focused on the product, or a casual selfie pose. Nothing staged or overly posed. The person looks like they actually use this product in daily life.

PRODUCT PLACEMENT: Product is visible but not perfectly positioned. Held at a natural angle, sitting on a surface organically, or being used in context. Brand label may be partially visible. The product looks like it belongs in this person's life.

FINAL STYLE: Authentic, relatable, scroll-stopping because it feels REAL. Think the kind of post that gets screenshot and sent to a friend — "omg have you tried this?" Warm, natural tones. Slight VSCO or Instagram filter vibe. This is the opposite of a polished ad — that's exactly why it works.`,

    bold: `Create a photo that looks like viral user-generated content with high energy and personality. Shot on a phone, feels authentic, but has that "this blew up" quality. NO graphic design elements, NO text overlays, NO logos.

CAMERA & QUALITY: Smartphone camera with slight motion energy — not blurry, but the framing feels spontaneous, like they grabbed their phone to capture this moment. Maybe slightly off-center or tilted. Flash photography OK for that raw, direct aesthetic. Vertical orientation.

SCENE & SETTING: Interesting or aspirational-but-attainable location — rooftop hangout, beach day, night out, trendy restaurant, concert, road trip, new apartment. The setting has personality and context. It's somewhere you'd want to be. Ambient environment lighting — golden hour, neon signs, string lights, natural window light.

SUBJECT & INTERACTION: Confident, expressive person with genuine energy. Big smile, mid-laugh, showing off the product with excitement, or a "look what I got" unboxing moment. The vibe is enthusiastic and infectious. Could be a selfie, a friend-took-this shot, or a mirror pic. Body language is open and animated.

PRODUCT PLACEMENT: Product is front-and-center but held naturally. Showing it off to the camera with pride, or captured in an exciting moment of use. The product is clearly the reason this content was created — but it doesn't feel like an ad, it feels like genuine excitement.

FINAL STYLE: High-energy, authentic, viral potential. Think TikTok "haul" or "obsessed with this" post energy. Warm, saturated tones — maybe pushed slightly in editing like a real person would. The image makes you want to buy the product because this person clearly loves it. Raw, real, magnetic.`,
  },

  minimalist: {
    clean: `Act as a Senior Art Director creating a minimalist advertisement.

COMPOSITION: Maximum negative space. One focal element — product, subject, or graphic element — positioned with precise geometric intent. Swiss design principles: grid-based, mathematically balanced. Nothing in the frame that doesn't serve a purpose. The emptiness IS the design.

SUBJECT & PRODUCT: Single product or subject rendered with absolute clarity. If product: isolated on clean surface with subtle shadow grounding. If subject: clean silhouette against solid background. No environmental clutter. The subject's own form, color, and texture provide all visual interest.

COLOR & SURFACE: Two to three colors maximum. Predominantly white, off-white, or single neutral tone. One brand accent color used sparingly — a single element, a subtle highlight. No gradients, no textures, no patterns. Flat, clean surfaces.

TYPOGRAPHY: If text is provided, one typeface only — clean geometric sans-serif. Generous letter-spacing. Text placement follows strict grid alignment. Small type, lots of space. Text whispers, never shouts. Position text at edges or corners, never competing with the focal element.

FINAL STYLE: Restrained, precise, museum-quality. Think Muji, Braun, or Apple at its most minimal. Every pixel is intentional. The beauty is in what's been removed. Photorealistic subject with no decorative elements.`,

    bold: `Act as a Senior Art Director creating a bold minimalist advertisement.

COMPOSITION: Stark, high-contrast minimalism. One dominant element against vast negative space — but that element COMMANDS attention. Oversized product, extreme close-up detail, or single bold graphic shape. Asymmetric placement creating tension. The contrast between emptiness and the focal element creates dramatic impact.

SUBJECT & PRODUCT: Subject or product presented at unexpected scale or crop. Extreme macro detail revealing texture and material. Or pulled back to a tiny element in vast space. The isolation amplifies importance. Bold color or material contrasts sharply with the background.

COLOR & SURFACE: Two colors maximum with extreme contrast. Black and white with one saturated accent, or a single bold color against pure white/black. No subtle tones — stark, definitive color choices. Flat matte surfaces. The color contrast does the heavy lifting.

TYPOGRAPHY: If text is provided, either very large (filling significant frame space) or very small (barely there). One weight, one size, one typeface. Text is part of the negative space composition, not decoration. Bold geometric sans-serif if large, thin refined if small.

FINAL STYLE: Stark, impactful, gallery-worthy. Think Japanese poster design or ACNE Studios campaign. Minimalism as a weapon — the restraint creates more impact than excess ever could. Every element at maximum contrast.`,
  },
};

export function composePrompt(options: {
  stylePreset: StylePreset;
  graphicType: GraphicType;
  variant: "clean" | "bold";
  userPrompt: string;
  hasReferences: boolean;
}): string {
  const { stylePreset, graphicType, variant, userPrompt, hasReferences } = options;
  const ref = hasReferences ? REF_INSTRUCTION : "";
  const platform = PLATFORM_CONTEXT[graphicType];
  const style = STYLE_PROMPTS[stylePreset][variant];
  return `${ref}${platform}\n\n${style}\n\nUser request: ${userPrompt}`;
}
