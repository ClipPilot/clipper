"use client";

import { useState } from "react";
import type { Key } from "@heroui/react";
import { Button, TextArea, Select, Label, ListBox, Spinner, TextField } from "@heroui/react";
import { toast } from "@/lib/toast";
import { Icon } from "@iconify/react";
import { useAtomValue } from "jotai";
import { useRouter } from "next/navigation";
import { selectedTeamAtom } from "@/store/auth";
import {} from "@/lib/plans";
import { ProductImageUploader } from "@/components/ugc-studio/script/ProductImageUploader";
import { graphicsAPI, type GeneratedGraphic } from "@/api/graphics";
import { GRAPHIC_TYPES, ASPECT_RATIOS, STYLE_PRESETS } from "@/config/graphicsConfig";
import type { ProductImage } from "@/components/ugc-studio/script/types";

export default function GraphicsPage() {
  const selectedTeam = useAtomValue(selectedTeamAtom);
  const router = useRouter();

  return <GraphicsContent teamId={selectedTeam.id} router={router} />;
}

function GraphicsContent({ teamId, router }: { teamId: number; router: ReturnType<typeof useRouter> }) {
  const [prompt, setPrompt] = useState("");
  const [graphicType, setGraphicType] = useState<Key | null>("instagram-ad");
  const [stylePreset, setStylePreset] = useState("tile-ad");
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
        graphicType: graphicType as string,
        stylePreset,
        aspectRatio,
        productImageKeys: productImages.map((img) => img.key) });
      setResults(response.images);
      toast({ title: "Graphics generated", description: `${response.images.length} images created successfully`, color: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      toast({ title: "Generation failed", description: message, color: "danger" });
    } finally {
      setGenerating(false);
    }
  };

  const handleUseAsReference = async (image: GeneratedGraphic) => {
    if (productImages.some((img) => img.key === image.s3Key)) {
      toast({ title: "Already added as reference", color: "warning" });
      return;
    }
    if (productImages.length >= 4) {
      toast({ title: "Max 4 reference images", description: "Remove one to add another", color: "warning" });
      return;
    }
    try {
      const response = await fetch(image.presignedUrl);
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      setProductImages((prev) => [...prev, { key: image.s3Key, url: localUrl }]);
      toast({ title: "Added as reference image", color: "success" });
    } catch {
      toast({ title: "Failed to add reference", color: "danger" });
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
      toast({ title: "Download failed", color: "danger" });
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="tertiary" isIconOnly onPress={() => router.push("/dashboard/ugc-studio")}>
            <Icon icon="solar:arrow-left-linear" width={20} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Graphics Generator</h1>
            <p className="text-text-secondary text-sm">Generate professional ad graphics with AI</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-surface-base border border-border-base rounded-xl p-5 space-y-5">
              <TextField fullWidth variant="secondary">
                <Label>Describe your graphic</Label>
                <TextArea
                  placeholder="E.g. A sleek product photo of wireless earbuds on a gradient background with bold typography saying 'Sound Reimagined'..."
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                  rows={4}
                />
              </TextField>

              <div>
                <ProductImageUploader
                  teamId={teamId}
                  maxImages={4}
                  images={productImages}
                  onImagesChange={setProductImages}
                  uploadFn={(tid, file) => graphicsAPI.uploadImage(tid, file)}
                />
              </div>
            </div>

            <div className="bg-surface-base border border-border-base rounded-xl p-5 space-y-5">
              <Select
                value={graphicType}
                onChange={(val: Key | null) => { if (val) setGraphicType(val); }}
                placeholder="Choose type"
                variant="secondary"
              >
                <Label>Graphic Type</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {GRAPHIC_TYPES.map((type) => (
                      <ListBox.Item key={type.id} id={type.id} textValue={type.name}>
                        <div className="flex items-center gap-3">
                          <Icon icon={type.icon} width={18} className="text-pink-400" />
                          <div>
                            <p className="text-sm font-medium">{type.name}</p>
                            <p className="text-xs text-muted">{type.description}</p>
                          </div>
                        </div>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">Style Preset</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {STYLE_PRESETS.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => setStylePreset(preset.id)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                        stylePreset === preset.id
                          ? "bg-pink-500/10 border-pink-500 text-text-primary"
                          : "bg-surface-elevated border-transparent text-text-secondary hover:border-border-base"
                      }`}
                    >
                      <Icon icon={preset.icon} width={16} className={stylePreset === preset.id ? "text-pink-400" : "text-text-tertiary"} />
                      <div className="min-w-0 overflow-hidden">
                        <p className="text-xs font-medium truncate">{preset.name}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-3">Aspect Ratio</label>
                <div className="flex flex-wrap gap-2">
                  {ASPECT_RATIOS.map((ratio) => (
                    <div
                      key={ratio.value}
                      onClick={() => setAspectRatio(ratio.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                        aspectRatio === ratio.value
                          ? "bg-pink-500 text-white border-pink-500"
                          : "bg-surface-elevated border-transparent text-text-secondary hover:border-border-base"
                      }`}
                    >
                      {ratio.label} <span className="opacity-60">{ratio.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              size="lg"
              className="w-full font-semibold bg-pink-500 text-white rounded-xl"
              isDisabled={!canGenerate}
              isPending={generating}
              onPress={handleGenerate}
            >
              {generating ? "Generating..." : "Generate — 4 Credits"}
            </Button>
          </div>

          <div>
            {generating ? (
              <div className="flex flex-col items-center justify-center h-96 bg-surface-base rounded-xl border border-border-base">
                <Spinner size="lg" color="accent" />
                <p className="text-text-secondary mt-4">Generating your graphics...</p>
                <p className="text-text-tertiary text-sm mt-1">This may take up to a minute</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-text-primary">Generated Graphics</h3>
                <div className="grid grid-cols-2 gap-3">
                  {results.map((image, index) => (
                    <div
                      key={image.s3Key}
                      className="rounded-xl overflow-hidden border border-border-base group hover:border-pink-400/40 transition-all"
                    >
                      <div className="relative">
                        <img src={image.presignedUrl} alt={`Graphic ${index + 1}`} className="w-full aspect-square object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-pink-500 text-white"
                            onPress={() => handleDownload(image, index)}
                          >
                            <Icon icon="solar:download-bold" width={14} />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-900"
                            onPress={() => handleUseAsReference(image)}
                          >
                            <Icon icon="solar:gallery-send-bold" width={14} />
                            Reference
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full min-h-96 bg-surface-base rounded-xl border border-dashed border-border-base">
                <Icon icon="solar:palette-bold-duotone" className="text-pink-400/30" width={64} />
                <p className="text-text-secondary mt-4 font-medium">Your graphics will appear here</p>
                <p className="text-text-tertiary text-sm mt-1">Fill in the details and click Generate</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
