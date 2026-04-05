"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Wand2,
  Upload,
  Download,
  Maximize2,
  Save,
  Camera,
  Loader2,
  ImageIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CameraAngleModal } from "@/components/camera-angle-modal";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api-client";
import {
  cn,
  ASPECT_RATIOS,
  ASPECT_RATIO_LABELS,
  type AspectRatio,
} from "@/lib/utils";

interface CharacterStyle {
  style_name: string;
  model: string;
  thumbnail_image: string;
  prompt_enhancer: string | null;
}

const FALLBACK_THUMBNAIL = "https://via.placeholder.com/150?text=No+Image";

function AspectRatioSelect({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as AspectRatio)}>
      <SelectTrigger className="h-10 min-w-[200px] max-w-xs border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800/80">
        <SelectValue placeholder="Aspect ratio" />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} className="border-zinc-600 bg-zinc-900">
        {ASPECT_RATIOS.map((r) => (
          <SelectItem key={r} value={r} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
            {ASPECT_RATIO_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StandaloneCharacterCreator() {
  const [activeTab, setActiveTab] = useState("generate");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<CharacterStyle | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [uploadStyledImageUrl, setUploadStyledImageUrl] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [cameraTargetImage, setCameraTargetImage] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState<string | null>(null);
  const [multiPoseByUrl, setMultiPoseByUrl] = useState<Record<string, string[]>>(
    {}
  );
  const [multiPosePendingUrl, setMultiPosePendingUrl] = useState<string | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: styles = [], isLoading: stylesLoading } = useQuery<CharacterStyle[]>({
    queryKey: ["character-styles"],
    queryFn: () => apiRequest("/api/characters/styles"),
  });

  const uploadStyles = styles.filter((s) => s.style_name !== "No style");

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStyle) throw new Error("No style selected");
      return apiRequest<{ imageUrls: string[]; prompt: string }>(
        "/api/characters/generate-options",
        {
          method: "POST",
          body: JSON.stringify({
            prompt,
            aspectRatio,
            style: selectedStyle.style_name,
            model: selectedStyle.model,
            promptEnhancer: selectedStyle.prompt_enhancer,
          }),
        }
      );
    },
    onSuccess: (data) => {
      setGeneratedImages(data.imageUrls);
      setGeneratedPrompt(data.prompt);
      setMultiPoseByUrl({});
      toast({ title: "Character generated!", description: "Your character image is ready." });
    },
    onError: (error: Error) => {
      toast({ title: "Generation failed", description: error.message, variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return apiRequest<{ imageUrl: string }>("/api/characters/upload", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (data) => {
      setUploadedImageUrl(data.imageUrl);
      setUploadStyledImageUrl(null);
      toast({ title: "Image uploaded", description: "Now select a style and click Change Style." });
    },
    onError: (error: Error) => {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    },
  });

  const changeStyleMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedImageUrl || !selectedStyle) throw new Error("Missing image or style");
      return apiRequest<{ imageUrl: string; prompt: string }>(
        "/api/characters/generate-image-to-image",
        {
          method: "POST",
          body: JSON.stringify({
            imageUrl: uploadedImageUrl,
            prompt: prompt || "character",
            promptEnhancer: selectedStyle.prompt_enhancer,
            aspectRatio,
          }),
        }
      );
    },
    onSuccess: (data) => {
      setUploadStyledImageUrl(data.imageUrl);
      setMultiPoseByUrl({});
      toast({ title: "Style applied!", description: "Your styled character is ready." });
    },
    onError: (error: Error) => {
      toast({ title: "Style change failed", description: error.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({
      name,
      prompt: p,
      imageUrl,
    }: {
      name: string;
      prompt: string;
      imageUrl: string;
    }) => {
      return apiRequest("/api/characters", {
        method: "POST",
        body: JSON.stringify({ name, prompt: p, imageUrl }),
      });
    },
    onSuccess: () => {
      setShowSaveInput(null);
      setSaveName("");
      toast({ title: "Saved!", description: "Character saved to library." });
    },
    onError: (error: Error) => {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    },
  });

  const multiPoseMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const context = (generatedPrompt || prompt || "").trim();
      return apiRequest<{ imageUrls: string[]; sequencePrompt: string }>(
        "/api/characters/multi-pose",
        {
          method: "POST",
          body: JSON.stringify({ imageUrl, context }),
        }
      );
    },
    onSuccess: (data, imageUrl) => {
      setMultiPoseByUrl((prev) => ({ ...prev, [imageUrl]: data.imageUrls }));
      toast({
        title: "Multi-pose ready",
        description: "Six pose variations were generated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Multi-pose failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setMultiPosePendingUrl(null);
    },
  });

  const handleGenerateMultiPose = (imageUrl: string) => {
    setMultiPosePendingUrl(imageUrl);
    multiPoseMutation.mutate(imageUrl);
  };

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
      if (!validTypes.includes(file.type)) {
        toast({ title: "Invalid file", description: "Please upload a JPEG, PNG, or GIF.", variant: "destructive" });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
        return;
      }

      uploadMutation.mutate(file);
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
        if (!validTypes.includes(file.type)) {
          toast({ title: "Invalid file", description: "Please upload a JPEG, PNG, or GIF.", variant: "destructive" });
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          toast({ title: "File too large", description: "Maximum file size is 5MB.", variant: "destructive" });
          return;
        }
        uploadMutation.mutate(file);
      }
    },
    [uploadMutation]
  );

  const handleDownload = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl, { mode: "cors" });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `character_${Date.now()}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", description: "Could not download the image. CORS may be blocking access.", variant: "destructive" });
    }
  };

  const handleSave = (imageUrl: string) => {
    if (showSaveInput === imageUrl && saveName.trim()) {
      saveMutation.mutate({
        name: saveName.trim(),
        prompt: generatedPrompt || prompt || "character",
        imageUrl,
      });
    } else {
      setShowSaveInput(imageUrl);
      setSaveName("");
    }
  };

  const handleCameraAngle = (imageUrl: string) => {
    setCameraTargetImage(imageUrl);
    setShowCameraModal(true);
  };

  const handleCameraResult = (newImageUrl: string) => {
    setGeneratedImages((prev) => [...prev, newImageUrl]);
    setShowCameraModal(false);
    setCameraTargetImage(null);
    toast({ title: "Camera angle applied!", description: "New angle image added." });
  };

  const isGenerateDisabled =
    prompt.trim().length <= 10 || !selectedStyle || generateMutation.isPending;

  return (
    <div className="w-full max-w-[1400px] mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold text-pink-500 mb-1 tracking-tight">
        Character Creator
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 h-auto w-full justify-start gap-8 rounded-none border-0 border-b border-zinc-800/90 bg-transparent p-0">
          <TabsTrigger
            value="generate"
            className="creator-tab-trigger gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Wand2 className="h-4 w-4" />
            Generate
          </TabsTrigger>
          <TabsTrigger
            value="upload"
            className="creator-tab-trigger gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        {/* -------- GENERATE TAB -------- */}
        <TabsContent value="generate" className="mt-0 outline-none">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
            <aside className="w-full shrink-0 lg:w-auto lg:max-w-[168px] xl:max-w-[180px]">
              <StylePicker
                title="Select Style"
                styles={styles}
                selectedStyle={selectedStyle}
                onSelect={setSelectedStyle}
                loading={stylesLoading}
              />
            </aside>

            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <Label className="mb-2 block text-base font-semibold text-white">
                  Describe Your Character
                </Label>
                <Textarea
                  placeholder="Describe your character in detail (at least 10 characters)..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="min-h-[120px] rounded-xl border-zinc-800 bg-black/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-pink-500/40"
                  maxLength={1000}
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Be detailed about appearance, style, clothing, and mood.
                  {prompt.trim().length > 0 && prompt.trim().length <= 10 && (
                    <span className="ml-2 text-amber-500">
                      Minimum 10 characters required.
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Label className="text-sm font-medium text-white">Aspect ratio</Label>
                <AspectRatioSelect value={aspectRatio} onChange={setAspectRatio} />
              </div>

              <Button
                onClick={() => generateMutation.mutate()}
                disabled={isGenerateDisabled}
                className="floating-button h-14 w-full rounded-xl text-base"
              >
                {generateMutation.isPending ? (
                  <>
                    <span className="loading-spinner mr-2" />
                    Generating...
                  </>
                ) : (
                  <>
                    <span className="mr-2" aria-hidden>
                      ✨
                    </span>
                    Generate Character
                  </>
                )}
              </Button>

              {generateMutation.isPending && (
                <div className="space-y-2">
                  <p className="text-center text-sm text-zinc-500">
                    This may take up to a few minutes...
                  </p>
                  <Progress value={undefined} className="h-2" />
                </div>
              )}

              <ImageResults
                images={generatedImages}
                onDownload={handleDownload}
                onExpand={setExpandedImage}
                onSave={handleSave}
                onCameraAngle={handleCameraAngle}
                showSaveInput={showSaveInput}
                saveName={saveName}
                setSaveName={setSaveName}
                savePending={saveMutation.isPending}
                multiPoseByUrl={multiPoseByUrl}
                multiPosePendingUrl={multiPosePendingUrl}
                onGenerateMultiPose={handleGenerateMultiPose}
              />
            </div>
          </div>
        </TabsContent>

        {/* -------- UPLOAD TAB -------- */}
        <TabsContent value="upload" className="mt-0 outline-none">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
            <aside className="w-full shrink-0 lg:w-auto lg:max-w-[168px] xl:max-w-[180px]">
              <StylePicker
                title="Select Style"
                styles={uploadStyles}
                selectedStyle={selectedStyle}
                onSelect={setSelectedStyle}
                loading={stylesLoading}
              />
            </aside>

            <div className="min-w-0 flex-1 space-y-5">
              <div>
                <Label className="mb-2 block text-base font-semibold text-white">
                  Upload an image
                </Label>
                <div
                  className="upload-zone rounded-xl"
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {uploadMutation.isPending ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                      <p className="text-zinc-400">Uploading...</p>
                    </div>
                  ) : uploadedImageUrl ? (
                    <div className="flex flex-col items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={uploadedImageUrl}
                        alt="Uploaded"
                        className="h-32 w-32 rounded-lg object-cover"
                      />
                      <p className="text-sm text-zinc-400">Click or drag to replace</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <ImageIcon className="h-12 w-12 text-zinc-600" />
                      <p className="font-medium text-zinc-300">
                        Drop your image here or click to browse
                      </p>
                      <p className="text-sm text-zinc-500">JPEG, PNG, GIF — Max 5MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {uploadedImageUrl && (
                <>
                  <div>
                    <Label className="mb-2 block text-base font-semibold text-white">
                      Describe your character (optional)
                    </Label>
                    <Textarea
                      placeholder="Add a description to guide the style transformation..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[80px] rounded-xl border-zinc-800 bg-black/60 text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-pink-500/40"
                      maxLength={1000}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <Label className="text-sm font-medium text-white">Aspect ratio</Label>
                    <AspectRatioSelect value={aspectRatio} onChange={setAspectRatio} />
                  </div>

                  <Button
                    onClick={() => changeStyleMutation.mutate()}
                    disabled={!selectedStyle || changeStyleMutation.isPending}
                    className="floating-button h-14 w-full rounded-xl text-base"
                  >
                    {changeStyleMutation.isPending ? (
                      <>
                        <span className="loading-spinner mr-2" />
                        Applying Style...
                      </>
                    ) : (
                      <>
                        <span className="mr-2" aria-hidden>
                          ✨
                        </span>
                        Change Style
                      </>
                    )}
                  </Button>

                  {changeStyleMutation.isPending && (
                    <div className="space-y-2">
                      <p className="text-center text-sm text-zinc-500">
                        Transforming your image...
                      </p>
                      <Progress value={undefined} className="h-2" />
                    </div>
                  )}

                  <ImageResults
                    images={uploadStyledImageUrl ? [uploadStyledImageUrl] : []}
                    onDownload={handleDownload}
                    onExpand={setExpandedImage}
                    onSave={handleSave}
                    onCameraAngle={handleCameraAngle}
                    showSaveInput={showSaveInput}
                    saveName={saveName}
                    setSaveName={setSaveName}
                    savePending={saveMutation.isPending}
                    multiPoseByUrl={multiPoseByUrl}
                    multiPosePendingUrl={multiPosePendingUrl}
                    onGenerateMultiPose={handleGenerateMultiPose}
                  />
                </>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {expandedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <button
            className="absolute right-4 top-4 text-white transition-colors hover:text-pink-400"
            onClick={() => setExpandedImage(null)}
          >
            <X className="h-8 w-8" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={expandedImage}
            alt="Expanded character"
            className="max-h-full max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {showCameraModal && cameraTargetImage && (
        <CameraAngleModal
          imageUrl={cameraTargetImage}
          open={showCameraModal}
          onOpenChange={setShowCameraModal}
          onResult={handleCameraResult}
        />
      )}
    </div>
  );
}

function StylePicker({
  title,
  styles,
  selectedStyle,
  onSelect,
  loading,
}: {
  title: string;
  styles: CharacterStyle[];
  selectedStyle: CharacterStyle | null;
  onSelect: (style: CharacterStyle) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-zinc-800/80 bg-black/40">
        <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
        <span className="ml-2 text-zinc-400">Loading styles...</span>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <h2 className="mb-3 text-base font-semibold text-white">{title}</h2>
      <div className="custom-scrollbar max-h-[min(72vh,560px)] min-h-[200px] overflow-y-auto pr-1.5">
        <div className="grid grid-cols-2 gap-2 pb-1">
          {styles.map((style) => (
            <button
              key={style.style_name}
              type="button"
              onClick={() => onSelect(style)}
              className={cn(
                "group relative aspect-[3/4] w-full overflow-hidden rounded-lg border-2 text-left transition-all",
                selectedStyle?.style_name === style.style_name
                  ? "border-pink-500 ring-1 ring-pink-500/40"
                  : "border-transparent hover:border-zinc-600"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={style.thumbnail_image}
                alt={style.style_name}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = FALLBACK_THUMBNAIL;
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-1 pb-1 pt-6">
                <p className="truncate text-center text-[10px] font-medium leading-tight text-white">
                  {style.style_name}
                </p>
              </div>
              {selectedStyle?.style_name === style.style_name && (
                <div className="pointer-events-none absolute inset-0 bg-pink-500/15" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageResults({
  images,
  onDownload,
  onExpand,
  onSave,
  onCameraAngle,
  showSaveInput,
  saveName,
  setSaveName,
  savePending,
  multiPoseByUrl,
  multiPosePendingUrl,
  onGenerateMultiPose,
}: {
  images: string[];
  onDownload: (url: string) => void;
  onExpand: (url: string) => void;
  onSave: (url: string) => void;
  onCameraAngle: (url: string) => void;
  showSaveInput: string | null;
  saveName: string;
  setSaveName: (v: string) => void;
  savePending: boolean;
  multiPoseByUrl: Record<string, string[]>;
  multiPosePendingUrl: string | null;
  onGenerateMultiPose: (url: string) => void;
}) {
  const posesFor = (mainUrl: string) => multiPoseByUrl[mainUrl] ?? [];

  return (
    <div className="space-y-4 pt-2">
      <h3 className="text-lg font-semibold text-white">Generated Characters</h3>
      {images.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 bg-black/30 py-12 text-center text-sm text-zinc-600">
          Generated images will appear here.
        </p>
      ) : (
        <div className="flex w-full flex-col items-stretch gap-8 sm:gap-10">
          {images.map((url, i) => {
            const poseUrls = posesFor(url);
            const isPoseLoading = multiPosePendingUrl === url;

            return (
              <div
                key={`${url}-${i}`}
                className="flex w-full max-w-2xl flex-col gap-4 self-center sm:max-w-none sm:self-stretch"
              >
                <div className="group relative box-border w-full min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50 sm:mx-auto sm:w-1/2 sm:min-w-[160px] sm:max-w-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`Generated character ${i + 1}`}
                    className="mx-auto block h-auto w-full max-h-[min(42.5vh,400px)] object-contain"
                  />
                  <div className="absolute right-2 top-2 flex flex-wrap justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-sm:opacity-100">
                    <button
                      type="button"
                      onClick={() => onExpand(url)}
                      className="rounded-lg bg-black/60 p-2 transition-colors hover:bg-black/80"
                      title="Expand"
                    >
                      <Maximize2 className="h-4 w-4 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(url)}
                      className="rounded-lg bg-black/60 p-2 transition-colors hover:bg-black/80"
                      title="Download"
                    >
                      <Download className="h-4 w-4 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCameraAngle(url)}
                      className="rounded-lg bg-black/60 p-2 transition-colors hover:bg-black/80"
                      title="Camera Angle"
                    >
                      <Camera className="h-4 w-4 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSave(url)}
                      className="rounded-lg bg-black/60 p-2 transition-colors hover:bg-black/80"
                      title="Save to Library"
                    >
                      <Save className="h-4 w-4 text-white" />
                    </button>
                  </div>

                  {showSaveInput === url && (
                    <div className="absolute bottom-0 inset-x-0 flex gap-2 bg-black/85 p-3">
                      <Input
                        placeholder="Character name..."
                        value={saveName}
                        onChange={(e) => setSaveName(e.target.value)}
                        className="h-8 flex-1 border-zinc-600 bg-zinc-900 text-sm"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") onSave(url);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => onSave(url)}
                        disabled={!saveName.trim() || savePending}
                        className="h-8 px-3"
                      >
                        {savePending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          "Save"
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex w-full flex-col gap-3 px-0 sm:items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isPoseLoading}
                    onClick={() => onGenerateMultiPose(url)}
                    className="h-11 w-full shrink-0 rounded-xl border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700 sm:max-w-md"
                  >
                    {isPoseLoading ? (
                      <>
                        <span className="loading-spinner mr-2" />
                        Generating multi-pose…
                      </>
                    ) : (
                      "Generate Multi-pose"
                    )}
                  </Button>

                  {poseUrls.length > 0 && (
                    <div className="w-full space-y-2">
                      <p className="text-center text-sm font-medium text-zinc-400 sm:text-left">
                        Pose variations
                      </p>
                      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {poseUrls.map((poseUrl, pi) => (
                          <div
                            key={`${poseUrl}-${pi}`}
                            className="group/pose relative box-border min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={poseUrl}
                              alt={`Pose ${pi + 1}`}
                              className="mx-auto block h-auto w-full max-h-[min(42.5vh,400px)] object-contain"
                            />
                            <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover/pose:opacity-100 max-sm:opacity-100">
                              <button
                                type="button"
                                onClick={() => onExpand(poseUrl)}
                                className="rounded-md bg-black/60 p-1.5 transition-colors hover:bg-black/80"
                                title="Expand"
                              >
                                <Maximize2 className="h-3.5 w-3.5 text-white" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDownload(poseUrl)}
                                className="rounded-md bg-black/60 p-1.5 transition-colors hover:bg-black/80"
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5 text-white" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
