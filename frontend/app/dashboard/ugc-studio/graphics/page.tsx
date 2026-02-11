"use client";

import { useState } from "react";
import { Button, Textarea, Select, SelectItem, Card, CardBody, Spinner, addToast } from "@heroui/react";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import { canAccessUGCStudio } from "@/lib/plans";
import { ScalePlanRequired } from "@/components/ugc-studio";
import { ProductImageUploader } from "@/components/ugc-studio/script/ProductImageUploader";
import { graphicsAPI, type GeneratedGraphic } from "@/api/graphics";
import { GRAPHIC_TYPES, ASPECT_RATIOS } from "@/config/graphicsConfig";
import type { ProductImage } from "@/components/ugc-studio/script/types";

type GenerationMode = "variations" | "carousel";


export default function GraphicsPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const router = useRouter();

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return <GraphicsContent teamId={selectedTeam.id} />;
}

function GraphicsContent({ teamId }: { teamId: number }) {
  const [prompt, setPrompt] = useState("");
  const [graphicType, setGraphicType] = useState("instagram-ad");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [mode, setMode] = useState<GenerationMode>("variations");
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<GeneratedGraphic[]>([]);

  const canGenerate = prompt.trim().length > 0 && !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setGenerating(true);
    setResults([]);

    try {
      const response = await graphicsAPI.generate({
        teamId,
        prompt: prompt.trim(),
        graphicType,
        aspectRatio,
        mode,
        productImageKeys: productImages.map((img) => img.key),
      });

      setResults(response.images);
      addToast({
        title: mode === "carousel" ? "Carousel created" : "Graphics generated",
        description: `${response.images.length} images created successfully`,
        color: "success",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      addToast({
        title: "Generation failed",
        description: message,
        color: "danger",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (image: GeneratedGraphic, index: number) => {
    try {
      const response = await fetch(image.presignedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const prefix = mode === "carousel" ? `carousel_slide` : graphicType;
      a.download = `${prefix}_${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      addToast({ title: "Download failed", color: "danger" });
    }
  };

  const handleDownloadAll = async () => {
    for (let i = 0; i < results.length; i++) {
      await handleDownload(results[i], i);
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-pink-500/10 border border-pink-500/20 mb-4">
            <Icon icon="solar:palette-bold-duotone" className="text-pink-400" width={18} />
            <span className="text-pink-400 text-sm font-medium">Graphics Generator</span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Graphics Generator
          </h1>
          <p className="text-text-secondary">
            Generate professional ad graphics with AI. Create variations or a ready-to-post carousel.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("variations")}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    mode === "variations"
                      ? "border-pink-400 bg-pink-500/10"
                      : "border-border-base bg-surface-base hover:border-pink-400/30"
                  }`}
                >
                  <Icon
                    icon="solar:gallery-bold-duotone"
                    width={24}
                    className={mode === "variations" ? "text-pink-400" : "text-text-muted"}
                  />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${mode === "variations" ? "text-pink-400" : "text-text-primary"}`}>
                      Variations
                    </p>
                    <p className="text-xs text-text-tertiary">4 different takes</p>
                  </div>
                </button>
                <button
                  onClick={() => setMode("carousel")}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                    mode === "carousel"
                      ? "border-pink-400 bg-pink-500/10"
                      : "border-border-base bg-surface-base hover:border-pink-400/30"
                  }`}
                >
                  <Icon
                    icon="solar:slider-horizontal-bold-duotone"
                    width={24}
                    className={mode === "carousel" ? "text-pink-400" : "text-text-muted"}
                  />
                  <div className="text-left">
                    <p className={`text-sm font-medium ${mode === "carousel" ? "text-pink-400" : "text-text-primary"}`}>
                      Carousel
                    </p>
                    <p className="text-xs text-text-tertiary">4 slides that flow</p>
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Describe your graphic
              </label>
              <Textarea
                placeholder={
                  mode === "carousel"
                    ? "E.g. Wireless earbuds carousel — show the product, highlight noise cancellation, lifestyle shot, and a clean CTA slide..."
                    : "E.g. A sleek product photo of wireless earbuds on a gradient background with bold typography saying 'Sound Reimagined'..."
                }
                value={prompt}
                onValueChange={setPrompt}
                minRows={4}
                maxRows={8}
                classNames={{
                  inputWrapper: "bg-surface-base border-border-base focus-within:!border-pink-400",
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Product Images (optional)
              </label>
              <ProductImageUploader
                teamId={teamId}
                maxImages={4}
                images={productImages}
                onImagesChange={setProductImages}
                uploadFn={(tid, file) => graphicsAPI.uploadImage(tid, file)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Graphic Type
              </label>
              <Select
                selectedKeys={[graphicType]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  if (selected) setGraphicType(selected);
                }}
                classNames={{
                  trigger: "bg-surface-base border-border-base",
                }}
              >
                {GRAPHIC_TYPES.map((type) => (
                  <SelectItem key={type.id} textValue={type.name}>
                    <div className="flex items-center gap-3">
                      <Icon icon={type.icon} width={20} className="text-pink-400" />
                      <div>
                        <p className="text-sm font-medium">{type.name}</p>
                        <p className="text-xs text-text-secondary">{type.description}</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-3">
                Aspect Ratio
              </label>
              <div className="flex flex-wrap gap-2">
                {ASPECT_RATIOS.map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => setAspectRatio(ratio.value)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      aspectRatio === ratio.value
                        ? "bg-pink-500 text-white"
                        : "bg-surface-base border border-border-base text-text-secondary hover:border-pink-400/50"
                    }`}
                  >
                    {ratio.label}
                    <span className="ml-1.5 opacity-70 text-xs">{ratio.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              size="lg"
              className="w-full font-semibold bg-pink-500 text-white hover:bg-pink-600"
              isDisabled={!canGenerate}
              isLoading={generating}
              onPress={handleGenerate}
            >
              {generating
                ? "Generating..."
                : mode === "carousel"
                  ? "Generate Carousel — 4 Credits"
                  : "Generate — 4 Credits"}
            </Button>
          </div>

          <div>
            {generating ? (
              <div className="flex flex-col items-center justify-center h-96 bg-surface-base rounded-2xl border border-border-base">
                <Spinner size="lg" classNames={{ circle1: "border-b-pink-400", circle2: "border-b-pink-400" }} />
                <p className="text-text-secondary mt-4">
                  {mode === "carousel" ? "Creating your carousel..." : "Generating your graphics..."}
                </p>
                <p className="text-text-tertiary text-sm mt-1">This may take up to a minute</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {mode === "carousel" ? "Your Carousel" : "Generated Graphics"}
                  </h3>
                  {mode === "carousel" && (
                    <Button
                      size="sm"
                      variant="flat"
                      className="bg-pink-500/10 text-pink-400"
                      onPress={handleDownloadAll}
                    >
                      <Icon icon="solar:download-bold" width={16} />
                      Download All
                    </Button>
                  )}
                </div>
                {mode === "carousel" ? (
                  <div className="space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {results.map((image, index) => (
                        <div key={image.s3Key} className="flex-shrink-0 w-56">
                          <Card className="bg-surface-base border border-border-base overflow-hidden group hover:border-pink-400/40 transition-all">
                            <CardBody className="p-0 relative">
                              <img
                                src={image.presignedUrl}
                                alt={`Slide ${index + 1}`}
                                className="w-full aspect-square object-cover"
                              />
                              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
                                <span className="text-xs font-medium text-white">
                                  Slide {index + 1}
                                </span>
                              </div>
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                                <Button
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 transition-opacity bg-pink-500 text-white"
                                  onPress={() => handleDownload(image, index)}
                                >
                                  <Icon icon="solar:download-bold" width={16} />
                                </Button>
                              </div>
                            </CardBody>
                          </Card>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-text-tertiary text-xs">
                      <Icon icon="solar:arrow-left-linear" width={14} />
                      <span>Scroll to preview all slides</span>
                      <Icon icon="solar:arrow-right-linear" width={14} />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {results.map((image, index) => (
                      <Card
                        key={image.s3Key}
                        className="bg-surface-base border border-border-base overflow-hidden group hover:border-pink-400/40 transition-all"
                      >
                        <CardBody className="p-0 relative">
                          <img
                            src={image.presignedUrl}
                            alt={`Generated graphic ${index + 1}`}
                            className="w-full aspect-square object-cover"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center">
                            <Button
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-pink-500 text-white"
                              onPress={() => handleDownload(image, index)}
                            >
                              <Icon icon="solar:download-bold" width={16} />
                              Download
                            </Button>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 bg-surface-base rounded-2xl border border-dashed border-border-base">
                <Icon
                  icon={mode === "carousel" ? "solar:slider-horizontal-bold-duotone" : "solar:palette-bold-duotone"}
                  className="text-pink-400/30"
                  width={64}
                />
                <p className="text-text-secondary mt-4 font-medium">
                  {mode === "carousel" ? "Your carousel will appear here" : "Your graphics will appear here"}
                </p>
                <p className="text-text-tertiary text-sm mt-1">
                  Fill in the details and click Generate
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
