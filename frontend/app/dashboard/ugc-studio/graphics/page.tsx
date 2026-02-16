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

export default function GraphicsPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const router = useRouter();

  if (!selectedTeam || !canAccessUGCStudio(selectedTeam.plan)) {
    return <ScalePlanRequired currentPlan={selectedTeam?.plan || "free"} />;
  }

  return <GraphicsContent teamId={selectedTeam.id} router={router} />;
}

function GraphicsContent({ teamId, router }: { teamId: number; router: ReturnType<typeof useRouter> }) {
  const [prompt, setPrompt] = useState("");
  const [graphicType, setGraphicType] = useState("instagram-ad");
  const [aspectRatio, setAspectRatio] = useState("1:1");
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
        productImageKeys: productImages.map((img) => img.key),
      });

      setResults(response.images);
      addToast({
        title: "Graphics generated",
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

  const handleUseAsReference = async (image: GeneratedGraphic) => {
    if (productImages.some((img) => img.key === image.s3Key)) {
      addToast({ title: "Already added as reference", color: "warning" });
      return;
    }
    if (productImages.length >= 4) {
      addToast({ title: "Max 4 reference images", description: "Remove one to add another", color: "warning" });
      return;
    }
    try {
      const response = await fetch(image.presignedUrl);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      setProductImages((prev) => [...prev, { key: image.s3Key, url: localUrl }]);
      addToast({ title: "Added as reference image", color: "success" });
    } catch {
      addToast({ title: "Failed to add reference", color: "danger" });
    }
  };

  const handleDownload = async (image: GeneratedGraphic, index: number) => {
    try {
      const response = await fetch(image.presignedUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${graphicType}_${index + 1}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      addToast({ title: "Download failed", color: "danger" });
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="light"
            isIconOnly
            onPress={() => router.push("/dashboard/ugc-studio")}
            className="text-text-secondary hover:text-text-primary"
          >
            <Icon icon="solar:arrow-left-linear" width={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              Graphics Generator
            </h1>
            <p className="text-text-secondary text-sm">
              Generate professional ad graphics with AI
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Describe your graphic
              </label>
              <Textarea
                placeholder="E.g. A sleek product photo of wireless earbuds on a gradient background with bold typography saying 'Sound Reimagined'..."
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
              {generating ? "Generating..." : "Generate — 4 Credits"}
            </Button>
          </div>

          <div>
            {generating ? (
              <div className="flex flex-col items-center justify-center h-96 bg-surface-base rounded-2xl border border-border-base">
                <Spinner size="lg" classNames={{ circle1: "border-b-pink-400", circle2: "border-b-pink-400" }} />
                <p className="text-text-secondary mt-4">
                  Generating your graphics...
                </p>
                <p className="text-text-tertiary text-sm mt-1">This may take up to a minute</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text-primary">
                  Generated Graphics
                </h3>
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
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-pink-500 text-white"
                            onPress={() => handleDownload(image, index)}
                          >
                            <Icon icon="solar:download-bold" width={16} />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900"
                            onPress={() => handleUseAsReference(image)}
                          >
                            <Icon icon="solar:gallery-send-bold" width={16} />
                            Use as Reference
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 bg-surface-base rounded-2xl border border-dashed border-border-base">
                <Icon
                  icon="solar:palette-bold-duotone"
                  className="text-pink-400/30"
                  width={64}
                />
                <p className="text-text-secondary mt-4 font-medium">
                  Your graphics will appear here
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
