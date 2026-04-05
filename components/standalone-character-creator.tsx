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
  RefreshCw,
  Film,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken } from "@/lib/api-client";
import {
  CHARACTER_BACKGROUNDS,
  CHARACTER_BACKGROUND_LABELS,
  CHARACTER_SHOT_TYPES,
  CHARACTER_SHOT_TYPE_LABELS,
  type CharacterBackground,
  type CharacterShotType,
} from "@/lib/character-framing";
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

function CharacterBackgroundSelect({
  value,
  onChange,
}: {
  value: CharacterBackground;
  onChange: (v: CharacterBackground) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as CharacterBackground)}
    >
      <SelectTrigger className="h-10 min-w-[160px] max-w-xs border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800/80">
        <SelectValue placeholder="Background" />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} className="border-zinc-600 bg-zinc-900">
        {CHARACTER_BACKGROUNDS.map((b) => (
          <SelectItem key={b} value={b} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
            {CHARACTER_BACKGROUND_LABELS[b]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CharacterShotTypeSelect({
  value,
  onChange,
}: {
  value: CharacterShotType;
  onChange: (v: CharacterShotType) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as CharacterShotType)}
    >
      <SelectTrigger className="h-10 min-w-[180px] max-w-xs border-zinc-600 bg-zinc-900 text-zinc-100 hover:bg-zinc-800/80">
        <SelectValue placeholder="Shot type" />
      </SelectTrigger>
      <SelectContent position="popper" sideOffset={6} className="border-zinc-600 bg-zinc-900">
        {CHARACTER_SHOT_TYPES.map((s) => (
          <SelectItem key={s} value={s} className="text-zinc-100 focus:bg-zinc-800 focus:text-white">
            {CHARACTER_SHOT_TYPE_LABELS[s]}
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
  const [characterBackground, setCharacterBackground] =
    useState<CharacterBackground>("black");
  const [characterShotType, setCharacterShotType] =
    useState<CharacterShotType>("front");
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
  const [multiPoseSequenceByUrl, setMultiPoseSequenceByUrl] = useState<
    Record<string, string>
  >({});
  const [multiPoseVideosByUrl, setMultiPoseVideosByUrl] = useState<
    Record<string, string[]>
  >({});
  const [multiPosePendingUrl, setMultiPosePendingUrl] = useState<string | null>(
    null
  );
  const [multiPoseVideosPendingUrl, setMultiPoseVideosPendingUrl] = useState<
    string | null
  >(null);
  const [multiExpressionByUrl, setMultiExpressionByUrl] = useState<
    Record<string, string[]>
  >({});
  const [multiExpressionSequenceByUrl, setMultiExpressionSequenceByUrl] =
    useState<Record<string, string>>({});
  const [multiExpressionVideosByUrl, setMultiExpressionVideosByUrl] = useState<
    Record<string, string[]>
  >({});
  const [multiExpressionPendingUrl, setMultiExpressionPendingUrl] = useState<
    string | null
  >(null);
  const [multiExpressionVideosPendingUrl, setMultiExpressionVideosPendingUrl] =
    useState<string | null>(null);
  const [multiPoseVideoPromptsByUrl, setMultiPoseVideoPromptsByUrl] = useState<
    Record<string, string[]>
  >({});
  const [multiExpressionVideoPromptsByUrl, setMultiExpressionVideoPromptsByUrl] =
    useState<Record<string, string[]>>({});
  const [videoRegenerateCtx, setVideoRegenerateCtx] = useState<null | {
    kind: "pose" | "expression";
    mainUrl: string;
    slotIndex: number;
    stillImageUrl: string;
  }>(null);
  const [videoRegenerateDraft, setVideoRegenerateDraft] = useState("");
  const [regeneratingVideoKey, setRegeneratingVideoKey] = useState<
    string | null
  >(null);
  const [videoGifUrlByVideoUrl, setVideoGifUrlByVideoUrl] = useState<
    Record<string, string>
  >({});
  const [videoGifConverting, setVideoGifConverting] = useState<
    Record<string, boolean>
  >({});

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
            background: characterBackground,
            shotType: characterShotType,
          }),
        }
      );
    },
    onSuccess: (data) => {
      setGeneratedImages(data.imageUrls);
      setGeneratedPrompt(data.prompt);
      setMultiPoseByUrl({});
      setMultiPoseSequenceByUrl({});
      setMultiPoseVideosByUrl({});
      setMultiPoseVideoPromptsByUrl({});
      setMultiExpressionByUrl({});
      setMultiExpressionSequenceByUrl({});
      setMultiExpressionVideosByUrl({});
      setMultiExpressionVideoPromptsByUrl({});
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
            background: characterBackground,
            shotType: characterShotType,
          }),
        }
      );
    },
    onSuccess: (data) => {
      setUploadStyledImageUrl(data.imageUrl);
      setMultiPoseByUrl({});
      setMultiPoseSequenceByUrl({});
      setMultiPoseVideosByUrl({});
      setMultiPoseVideoPromptsByUrl({});
      setMultiExpressionByUrl({});
      setMultiExpressionSequenceByUrl({});
      setMultiExpressionVideosByUrl({});
      setMultiExpressionVideoPromptsByUrl({});
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
          body: JSON.stringify({
            imageUrl,
            context,
            background: characterBackground,
            shotType: characterShotType,
          }),
        }
      );
    },
    onSuccess: (data, imageUrl) => {
      setMultiPoseByUrl((prev) => ({ ...prev, [imageUrl]: data.imageUrls }));
      setMultiPoseSequenceByUrl((prev) => ({
        ...prev,
        [imageUrl]: data.sequencePrompt,
      }));
      setMultiPoseVideosByUrl((prev) => {
        const next = { ...prev };
        delete next[imageUrl];
        return next;
      });
      setMultiPoseVideoPromptsByUrl((prev) => {
        const next = { ...prev };
        delete next[imageUrl];
        return next;
      });
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

  const multiExpressionMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const context = (generatedPrompt || prompt || "").trim();
      return apiRequest<{
        imageUrls: string[];
        sequencePrompt: string;
        prompts?: string[];
      }>("/api/characters/multi-expression", {
        method: "POST",
        body: JSON.stringify({
          imageUrl,
          context,
          aspectRatio,
          background: characterBackground,
          shotType: characterShotType,
        }),
      });
    },
    onSuccess: (data, imageUrl) => {
      setMultiExpressionByUrl((prev) => ({
        ...prev,
        [imageUrl]: data.imageUrls,
      }));
      setMultiExpressionSequenceByUrl((prev) => ({
        ...prev,
        [imageUrl]: data.sequencePrompt,
      }));
      setMultiExpressionVideosByUrl((prev) => {
        const next = { ...prev };
        delete next[imageUrl];
        return next;
      });
      setMultiExpressionVideoPromptsByUrl((prev) => {
        const next = { ...prev };
        delete next[imageUrl];
        return next;
      });
      toast({
        title: "Multi-expression ready",
        description: "Six expression variations were generated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Multi-expression failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setMultiExpressionPendingUrl(null);
    },
  });

  const handleGenerateMultiExpression = (imageUrl: string) => {
    setMultiExpressionPendingUrl(imageUrl);
    multiExpressionMutation.mutate(imageUrl);
  };

  const sequentialVideosMutation = useMutation({
    mutationFn: async ({
      imageUrls,
      sequencePrompt,
      context,
      kind,
      background,
      shotType,
    }: {
      mainUrl: string;
      imageUrls: string[];
      sequencePrompt: string;
      context: string;
      kind: "pose" | "expression";
      background: CharacterBackground;
      shotType: CharacterShotType;
    }) => {
      return apiRequest<{ videoUrls: string[]; videoPrompts: string[] }>(
        "/api/characters/multi-pose-videos",
        {
          method: "POST",
          body: JSON.stringify({
            imageUrls,
            sequencePrompt,
            context,
            videoKind: kind,
            background,
            shotType,
          }),
        }
      );
    },
    onSuccess: (data, { mainUrl, kind }) => {
      if (kind === "pose") {
        setMultiPoseVideosByUrl((prev) => ({
          ...prev,
          [mainUrl]: data.videoUrls,
        }));
        setMultiPoseVideoPromptsByUrl((prev) => ({
          ...prev,
          [mainUrl]: data.videoPrompts,
        }));
        toast({
          title: "Videos ready",
          description: "Six 3-second pose clips were generated.",
        });
      } else {
        setMultiExpressionVideosByUrl((prev) => ({
          ...prev,
          [mainUrl]: data.videoUrls,
        }));
        setMultiExpressionVideoPromptsByUrl((prev) => ({
          ...prev,
          [mainUrl]: data.videoPrompts,
        }));
        toast({
          title: "Videos ready",
          description: "Six 3-second expression clips were generated.",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Video generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_data, _err, variables) => {
      if (variables?.kind === "pose") {
        setMultiPoseVideosPendingUrl(null);
      } else if (variables?.kind === "expression") {
        setMultiExpressionVideosPendingUrl(null);
      }
    },
  });

  const regenerateVideoMutation = useMutation({
    mutationFn: async (vars: {
      kind: "pose" | "expression";
      mainUrl: string;
      slotIndex: number;
      stillImageUrl: string;
      prompt: string;
    }) => {
      const { videoUrl } = await apiRequest<{ videoUrl: string }>(
        "/api/characters/video-from-image",
        {
          method: "POST",
          body: JSON.stringify({
            imageUrl: vars.stillImageUrl,
            prompt: vars.prompt,
          }),
        }
      );
      return { ...vars, videoUrl };
    },
    onMutate: (vars) => {
      setRegeneratingVideoKey(
        `${vars.kind}:${vars.mainUrl}:${vars.slotIndex}`
      );
    },
    onSuccess: (data) => {
      const { kind, mainUrl, slotIndex, prompt, videoUrl } = data;
      if (kind === "pose") {
        setMultiPoseVideosByUrl((prev) => {
          const cur = [...(prev[mainUrl] ?? [])];
          cur[slotIndex] = videoUrl;
          return { ...prev, [mainUrl]: cur };
        });
        setMultiPoseVideoPromptsByUrl((prev) => {
          const cur = [...(prev[mainUrl] ?? [])];
          cur[slotIndex] = prompt;
          return { ...prev, [mainUrl]: cur };
        });
      } else {
        setMultiExpressionVideosByUrl((prev) => {
          const cur = [...(prev[mainUrl] ?? [])];
          cur[slotIndex] = videoUrl;
          return { ...prev, [mainUrl]: cur };
        });
        setMultiExpressionVideoPromptsByUrl((prev) => {
          const cur = [...(prev[mainUrl] ?? [])];
          cur[slotIndex] = prompt;
          return { ...prev, [mainUrl]: cur };
        });
      }
      setVideoRegenerateCtx(null);
      setVideoRegenerateDraft("");
      toast({
        title: "Video regenerated",
        description: `Clip ${slotIndex + 1} was updated.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Regeneration failed",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setRegeneratingVideoKey(null);
    },
  });

  const openVideoRegenerateModal = (p: {
    kind: "pose" | "expression";
    mainUrl: string;
    slotIndex: number;
    stillImageUrl: string;
    prompt: string;
  }) => {
    setVideoRegenerateCtx({
      kind: p.kind,
      mainUrl: p.mainUrl,
      slotIndex: p.slotIndex,
      stillImageUrl: p.stillImageUrl,
    });
    setVideoRegenerateDraft(p.prompt);
  };

  const submitVideoRegenerate = () => {
    const trimmed = videoRegenerateDraft.trim();
    if (!videoRegenerateCtx) return;
    if (!trimmed) {
      toast({
        title: "Prompt required",
        description: "Enter a motion prompt for the video.",
        variant: "destructive",
      });
      return;
    }
    regenerateVideoMutation.mutate({
      kind: videoRegenerateCtx.kind,
      mainUrl: videoRegenerateCtx.mainUrl,
      slotIndex: videoRegenerateCtx.slotIndex,
      stillImageUrl: videoRegenerateCtx.stillImageUrl,
      prompt: trimmed,
    });
  };

  const handleGenerateVideos = (mainUrl: string) => {
    const poses = multiPoseByUrl[mainUrl];
    const seq = multiPoseSequenceByUrl[mainUrl];
    if (!poses || poses.length !== 6 || !seq?.trim()) {
      toast({
        title: "Multi-pose required",
        description: "Generate multi-pose images first (six poses).",
        variant: "destructive",
      });
      return;
    }
    setMultiPoseVideosPendingUrl(mainUrl);
    sequentialVideosMutation.mutate({
      mainUrl,
      imageUrls: poses,
      sequencePrompt: seq,
      context: (generatedPrompt || prompt || "").trim(),
      kind: "pose",
      background: characterBackground,
      shotType: characterShotType,
    });
  };

  const handleGenerateExpressionVideos = (mainUrl: string) => {
    const expr = multiExpressionByUrl[mainUrl];
    const seq = multiExpressionSequenceByUrl[mainUrl];
    if (!expr || expr.length !== 6 || !seq?.trim()) {
      toast({
        title: "Multi-expression required",
        description:
          "Generate multi-expression images first (six expression stills).",
        variant: "destructive",
      });
      return;
    }
    setMultiExpressionVideosPendingUrl(mainUrl);
    sequentialVideosMutation.mutate({
      mainUrl,
      imageUrls: expr,
      sequencePrompt: seq,
      context: (generatedPrompt || prompt || "").trim(),
      kind: "expression",
      background: characterBackground,
      shotType: characterShotType,
    });
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

  const handleDownload = async (mediaUrl: string) => {
    const isFfmpegGifHost = (() => {
      try {
        const u = new URL(mediaUrl);
        const h = u.hostname.toLowerCase();
        return h === "ffmpegapi.net" || h.endsWith(".ffmpegapi.net");
      } catch {
        return false;
      }
    })();

    try {
      const proxyHeaders: Record<string, string> = {};
      const token = getAuthToken();
      if (token) proxyHeaders.Authorization = `Bearer ${token}`;

      const response = isFfmpegGifHost
        ? await fetch(
            `/api/characters/proxy-download?url=${encodeURIComponent(mediaUrl)}`,
            { headers: proxyHeaders }
          )
        : await fetch(mediaUrl, { mode: "cors" });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(
          errJson && typeof errJson.error === "string"
            ? errJson.error
            : `HTTP ${response.status}`
        );
      }

      const blob = await response.blob();
      const ext =
        blob.type === "image/gif" || /\.gif(\?|$)/i.test(mediaUrl)
          ? "gif"
          : blob.type.startsWith("video/") ||
              /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl)
            ? "mp4"
            : "jpg";

      const cd = response.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      const suggestedName = match?.[1];

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        suggestedName ||
        `character_${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Download failed",
        description:
          e instanceof Error
            ? e.message
            : isFfmpegGifHost
              ? "Could not download the file through the server."
              : "Could not download the file. CORS may be blocking access.",
        variant: "destructive",
      });
    }
  };

  const handleConvertVideoToGif = useCallback(async (videoUrl: string) => {
    setVideoGifConverting((prev) => ({ ...prev, [videoUrl]: true }));
    try {
      const data = await apiRequest<{ download_url?: string }>(
        "/api/characters/convert-video-to-gif",
        {
          method: "POST",
          body: JSON.stringify({ video_url: videoUrl }),
        }
      );
      if (data.download_url) {
        const downloadUrl = data.download_url;
        setVideoGifUrlByVideoUrl((prev) => ({
          ...prev,
          [videoUrl]: downloadUrl,
        }));
        toast({
          title: "GIF ready",
          description: "Use Download GIF to save it.",
        });
      }
    } catch (e) {
      toast({
        title: "GIF conversion failed",
        description:
          e instanceof Error ? e.message : "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setVideoGifConverting((prev) => {
        const next = { ...prev };
        delete next[videoUrl];
        return next;
      });
    }
  }, []);

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

              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm font-medium text-white">Aspect ratio</Label>
                  <AspectRatioSelect value={aspectRatio} onChange={setAspectRatio} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm font-medium text-white">Background</Label>
                  <CharacterBackgroundSelect
                    value={characterBackground}
                    onChange={setCharacterBackground}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-sm font-medium text-white">Shot type</Label>
                  <CharacterShotTypeSelect
                    value={characterShotType}
                    onChange={setCharacterShotType}
                  />
                </div>
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
                multiPoseSequenceByUrl={multiPoseSequenceByUrl}
                multiPoseVideosByUrl={multiPoseVideosByUrl}
                multiPosePendingUrl={multiPosePendingUrl}
                multiPoseVideosPendingUrl={multiPoseVideosPendingUrl}
                onGenerateMultiPose={handleGenerateMultiPose}
                onGenerateMultiExpression={handleGenerateMultiExpression}
                multiExpressionByUrl={multiExpressionByUrl}
                multiExpressionSequenceByUrl={multiExpressionSequenceByUrl}
                multiExpressionVideosByUrl={multiExpressionVideosByUrl}
                multiExpressionPendingUrl={multiExpressionPendingUrl}
                multiExpressionVideosPendingUrl={
                  multiExpressionVideosPendingUrl
                }
                onGenerateVideos={handleGenerateVideos}
                onGenerateExpressionVideos={handleGenerateExpressionVideos}
                multiPoseVideoPromptsByUrl={multiPoseVideoPromptsByUrl}
                multiExpressionVideoPromptsByUrl={
                  multiExpressionVideoPromptsByUrl
                }
                onOpenVideoRegenerate={openVideoRegenerateModal}
                regeneratingVideoKey={regeneratingVideoKey}
                videoGifUrlByVideoUrl={videoGifUrlByVideoUrl}
                videoGifConverting={videoGifConverting}
                onConvertVideoToGif={handleConvertVideoToGif}
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

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm font-medium text-white">Aspect ratio</Label>
                      <AspectRatioSelect value={aspectRatio} onChange={setAspectRatio} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm font-medium text-white">Background</Label>
                      <CharacterBackgroundSelect
                        value={characterBackground}
                        onChange={setCharacterBackground}
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-sm font-medium text-white">Shot type</Label>
                      <CharacterShotTypeSelect
                        value={characterShotType}
                        onChange={setCharacterShotType}
                      />
                    </div>
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
                    multiPoseSequenceByUrl={multiPoseSequenceByUrl}
                    multiPoseVideosByUrl={multiPoseVideosByUrl}
                    multiPosePendingUrl={multiPosePendingUrl}
                    multiPoseVideosPendingUrl={multiPoseVideosPendingUrl}
                    onGenerateMultiPose={handleGenerateMultiPose}
                    onGenerateMultiExpression={handleGenerateMultiExpression}
                    multiExpressionByUrl={multiExpressionByUrl}
                    multiExpressionSequenceByUrl={multiExpressionSequenceByUrl}
                    multiExpressionVideosByUrl={multiExpressionVideosByUrl}
                    multiExpressionPendingUrl={multiExpressionPendingUrl}
                    multiExpressionVideosPendingUrl={
                      multiExpressionVideosPendingUrl
                    }
                    onGenerateVideos={handleGenerateVideos}
                    onGenerateExpressionVideos={handleGenerateExpressionVideos}
                    multiPoseVideoPromptsByUrl={multiPoseVideoPromptsByUrl}
                    multiExpressionVideoPromptsByUrl={
                      multiExpressionVideoPromptsByUrl
                    }
                    onOpenVideoRegenerate={openVideoRegenerateModal}
                    regeneratingVideoKey={regeneratingVideoKey}
                    videoGifUrlByVideoUrl={videoGifUrlByVideoUrl}
                    videoGifConverting={videoGifConverting}
                    onConvertVideoToGif={handleConvertVideoToGif}
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

      <Dialog
        open={videoRegenerateCtx !== null}
        onOpenChange={(open) => {
          if (!open) {
            setVideoRegenerateCtx(null);
            setVideoRegenerateDraft("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto border-zinc-700 bg-zinc-900 text-zinc-100 sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">Regenerate video</DialogTitle>
            <DialogDescription className="text-zinc-400">
              Edit the motion prompt for Wan 2.6 image-to-video, then regenerate
              this clip from the same still image.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <Label htmlFor="video-regenerate-prompt" className="text-zinc-300">
              Motion prompt
            </Label>
            <Textarea
              id="video-regenerate-prompt"
              value={videoRegenerateDraft}
              onChange={(e) => setVideoRegenerateDraft(e.target.value)}
              className="min-h-[120px] border-zinc-600 bg-black/50 text-zinc-100 placeholder:text-zinc-600"
              placeholder="Describe subtle motion for this clip…"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                className="border-zinc-600 bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
                onClick={() => {
                  setVideoRegenerateCtx(null);
                  setVideoRegenerateDraft("");
                }}
                disabled={regenerateVideoMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="floating-button"
                onClick={submitVideoRegenerate}
                disabled={regenerateVideoMutation.isPending}
              >
                {regenerateVideoMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Regenerating…
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  multiPoseSequenceByUrl,
  multiPoseVideosByUrl,
  multiPosePendingUrl,
  multiPoseVideosPendingUrl,
  onGenerateMultiPose,
  onGenerateMultiExpression,
  multiExpressionByUrl,
  multiExpressionSequenceByUrl,
  multiExpressionVideosByUrl,
  multiExpressionPendingUrl,
  multiExpressionVideosPendingUrl,
  onGenerateVideos,
  onGenerateExpressionVideos,
  multiPoseVideoPromptsByUrl,
  multiExpressionVideoPromptsByUrl,
  onOpenVideoRegenerate,
  regeneratingVideoKey,
  videoGifUrlByVideoUrl,
  videoGifConverting,
  onConvertVideoToGif,
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
  multiPoseSequenceByUrl: Record<string, string>;
  multiPoseVideosByUrl: Record<string, string[]>;
  multiPosePendingUrl: string | null;
  multiPoseVideosPendingUrl: string | null;
  onGenerateMultiPose: (url: string) => void;
  onGenerateMultiExpression: (url: string) => void;
  multiExpressionByUrl: Record<string, string[]>;
  multiExpressionSequenceByUrl: Record<string, string>;
  multiExpressionVideosByUrl: Record<string, string[]>;
  multiExpressionPendingUrl: string | null;
  multiExpressionVideosPendingUrl: string | null;
  onGenerateVideos: (url: string) => void;
  onGenerateExpressionVideos: (url: string) => void;
  multiPoseVideoPromptsByUrl: Record<string, string[]>;
  multiExpressionVideoPromptsByUrl: Record<string, string[]>;
  onOpenVideoRegenerate: (p: {
    kind: "pose" | "expression";
    mainUrl: string;
    slotIndex: number;
    stillImageUrl: string;
    prompt: string;
  }) => void;
  regeneratingVideoKey: string | null;
  videoGifUrlByVideoUrl: Record<string, string>;
  videoGifConverting: Record<string, boolean>;
  onConvertVideoToGif: (videoUrl: string) => void;
}) {
  const posesFor = (mainUrl: string) => multiPoseByUrl[mainUrl] ?? [];
  const expressionsFor = (mainUrl: string) =>
    multiExpressionByUrl[mainUrl] ?? [];
  const videosFor = (mainUrl: string) => multiPoseVideosByUrl[mainUrl] ?? [];
  const expressionVideosFor = (mainUrl: string) =>
    multiExpressionVideosByUrl[mainUrl] ?? [];
  const poseVideoPromptsFor = (mainUrl: string) =>
    multiPoseVideoPromptsByUrl[mainUrl] ?? [];
  const expressionVideoPromptsFor = (mainUrl: string) =>
    multiExpressionVideoPromptsByUrl[mainUrl] ?? [];

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
            const expressionUrls = expressionsFor(url);
            const videoUrls = videosFor(url);
            const expressionVideoUrls = expressionVideosFor(url);
            const poseVideoPrompts = poseVideoPromptsFor(url);
            const expressionVideoPrompts = expressionVideoPromptsFor(url);
            const isPoseLoading = multiPosePendingUrl === url;
            const isExpressionLoading = multiExpressionPendingUrl === url;
            const isPoseVideosLoading = multiPoseVideosPendingUrl === url;
            const isExpressionVideosLoading =
              multiExpressionVideosPendingUrl === url;
            const isAnyVideosLoading =
              isPoseVideosLoading || isExpressionVideosLoading;
            const hasPoseSequence = Boolean(
              multiPoseSequenceByUrl[url]?.trim()
            );
            const hasExpressionSequence = Boolean(
              multiExpressionSequenceByUrl[url]?.trim()
            );

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
                  <div className="flex w-full max-w-md flex-col gap-2 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPoseLoading || isExpressionLoading}
                      onClick={() => onGenerateMultiPose(url)}
                      className="h-11 w-full shrink-0 rounded-xl border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700 sm:min-w-[10.5rem] sm:flex-1 sm:max-w-[14rem]"
                    >
                      {isPoseLoading ? (
                        <>
                          <span className="loading-spinner mr-2" />
                          Multi-pose…
                        </>
                      ) : (
                        "Generate Multi-pose"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isPoseLoading || isExpressionLoading}
                      onClick={() => onGenerateMultiExpression(url)}
                      className="h-11 w-full shrink-0 rounded-xl border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700 sm:min-w-[10.5rem] sm:flex-1 sm:max-w-[14rem]"
                    >
                      {isExpressionLoading ? (
                        <>
                          <span className="loading-spinner mr-2" />
                          Multi-expression…
                        </>
                      ) : (
                        "Generate Multi-expression"
                      )}
                    </Button>
                  </div>

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

                      {poseUrls.length === 6 && hasPoseSequence && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={isAnyVideosLoading}
                            onClick={() => onGenerateVideos(url)}
                            className="mt-2 h-11 w-full shrink-0 rounded-xl border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700 sm:max-w-md"
                          >
                            {isPoseVideosLoading ? (
                              <>
                                <span className="loading-spinner mr-2" />
                                Generating pose videos…
                              </>
                            ) : (
                              "Generate Pose Videos"
                            )}
                          </Button>

                          {videoUrls.length > 0 && (
                            <div className="mt-4 w-full space-y-2">
                              <p className="text-center text-sm font-medium text-zinc-400 sm:text-left">
                                Pose videos (3s each)
                              </p>
                              <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {videoUrls.map((videoUrl, vi) => {
                                  const regenKey = `pose:${url}:${vi}`;
                                  const isSlotRegenerating =
                                    regeneratingVideoKey === regenKey;
                                  const motionPrompt =
                                    poseVideoPrompts[vi] ?? "";
                                  const gifUrl =
                                    videoGifUrlByVideoUrl[videoUrl];
                                  const gifBusy =
                                    videoGifConverting[videoUrl] === true;
                                  return (
                                    <div
                                      key={`pose-vid-card-${url}-${vi}`}
                                      className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-950/80 p-3 shadow-lg shadow-black/25"
                                    >
                                      <div className="group/vid relative overflow-hidden rounded-lg border border-zinc-800 bg-black">
                                        <video
                                          key={videoUrl}
                                          src={videoUrl}
                                          controls
                                          playsInline
                                          className="mx-auto block aspect-video w-full object-contain"
                                          preload="metadata"
                                        />
                                        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover/vid:opacity-100 max-sm:opacity-100">
                                          <button
                                            type="button"
                                            onClick={() => onDownload(videoUrl)}
                                            className="rounded-md bg-black/70 p-2 transition-colors hover:bg-black/90"
                                            title="Download video"
                                          >
                                            <Download className="h-4 w-4 text-white" />
                                          </button>
                                        </div>
                                      </div>
                                      <p className="mt-2 line-clamp-2 text-center text-xs text-zinc-500">
                                        Clip {vi + 1}
                                      </p>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="mt-2 h-9 w-full shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700"
                                        disabled={
                                          isPoseVideosLoading ||
                                          isSlotRegenerating
                                        }
                                        onClick={() =>
                                          onOpenVideoRegenerate({
                                            kind: "pose",
                                            mainUrl: url,
                                            slotIndex: vi,
                                            stillImageUrl: poseUrls[vi],
                                            prompt: motionPrompt,
                                          })
                                        }
                                      >
                                        {isSlotRegenerating ? (
                                          <>
                                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                            Regenerating…
                                          </>
                                        ) : (
                                          <>
                                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                            Regenerate
                                          </>
                                        )}
                                      </Button>
                                      {gifUrl ? (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          className="mt-2 h-9 w-full shrink-0 rounded-lg border border-emerald-700/80 bg-emerald-950/50 text-emerald-100 hover:bg-emerald-900/40"
                                          onClick={() => onDownload(gifUrl)}
                                        >
                                          <Download className="mr-2 h-3.5 w-3.5" />
                                          Download GIF
                                        </Button>
                                      ) : (
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          className="mt-2 h-9 w-full shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700"
                                          disabled={
                                            isPoseVideosLoading ||
                                            isSlotRegenerating ||
                                            gifBusy
                                          }
                                          onClick={() =>
                                            onConvertVideoToGif(videoUrl)
                                          }
                                        >
                                          {gifBusy ? (
                                            <>
                                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                              Converting…
                                            </>
                                          ) : (
                                            <>
                                              <Film className="mr-2 h-3.5 w-3.5" />
                                              Convert to GIF
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {expressionUrls.length > 0 && (
                    <div className="w-full space-y-2">
                      <p className="text-center text-sm font-medium text-zinc-400 sm:text-left">
                        Expression variations (same pose, face only)
                      </p>
                      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                        {expressionUrls.map((exprUrl, ei) => (
                          <div
                            key={`${exprUrl}-${ei}`}
                            className="group/expr relative box-border min-w-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={exprUrl}
                              alt={`Expression ${ei + 1}`}
                              className="mx-auto block h-auto w-full max-h-[min(42.5vh,400px)] object-contain"
                            />
                            <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover/expr:opacity-100 max-sm:opacity-100">
                              <button
                                type="button"
                                onClick={() => onExpand(exprUrl)}
                                className="rounded-md bg-black/60 p-1.5 transition-colors hover:bg-black/80"
                                title="Expand"
                              >
                                <Maximize2 className="h-3.5 w-3.5 text-white" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDownload(exprUrl)}
                                className="rounded-md bg-black/60 p-1.5 transition-colors hover:bg-black/80"
                                title="Download"
                              >
                                <Download className="h-3.5 w-3.5 text-white" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {expressionUrls.length === 6 &&
                        hasExpressionSequence && (
                          <>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={isAnyVideosLoading}
                              onClick={() => onGenerateExpressionVideos(url)}
                              className="mt-2 h-11 w-full shrink-0 rounded-xl border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700 sm:max-w-md"
                            >
                              {isExpressionVideosLoading ? (
                                <>
                                  <span className="loading-spinner mr-2" />
                                  Generating expression videos…
                                </>
                              ) : (
                                "Generate Expression Videos"
                              )}
                            </Button>

                            {expressionVideoUrls.length > 0 && (
                              <div className="mt-4 w-full space-y-2">
                                <p className="text-center text-sm font-medium text-zinc-400 sm:text-left">
                                  Expression videos (3s each)
                                </p>
                                <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                  {expressionVideoUrls.map((videoUrl, vi) => {
                                    const regenKey = `expression:${url}:${vi}`;
                                    const isSlotRegenerating =
                                      regeneratingVideoKey === regenKey;
                                    const motionPrompt =
                                      expressionVideoPrompts[vi] ?? "";
                                    const gifUrl =
                                      videoGifUrlByVideoUrl[videoUrl];
                                    const gifBusy =
                                      videoGifConverting[videoUrl] === true;
                                    return (
                                      <div
                                        key={`expr-vid-card-${url}-${vi}`}
                                        className="flex flex-col rounded-xl border border-zinc-700 bg-zinc-950/80 p-3 shadow-lg shadow-black/25"
                                      >
                                        <div className="group/exprvid relative overflow-hidden rounded-lg border border-zinc-800 bg-black">
                                          <video
                                            key={videoUrl}
                                            src={videoUrl}
                                            controls
                                            playsInline
                                            className="mx-auto block aspect-video w-full object-contain"
                                            preload="metadata"
                                          />
                                          <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover/exprvid:opacity-100 max-sm:opacity-100">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onDownload(videoUrl)
                                              }
                                              className="rounded-md bg-black/70 p-2 transition-colors hover:bg-black/90"
                                              title="Download video"
                                            >
                                              <Download className="h-4 w-4 text-white" />
                                            </button>
                                          </div>
                                        </div>
                                        <p className="mt-2 line-clamp-2 text-center text-xs text-zinc-500">
                                          Clip {vi + 1}
                                        </p>
                                        <Button
                                          type="button"
                                          variant="secondary"
                                          size="sm"
                                          className="mt-2 h-9 w-full shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700"
                                          disabled={
                                            isExpressionVideosLoading ||
                                            isSlotRegenerating
                                          }
                                          onClick={() =>
                                            onOpenVideoRegenerate({
                                              kind: "expression",
                                              mainUrl: url,
                                              slotIndex: vi,
                                              stillImageUrl:
                                                expressionUrls[vi],
                                              prompt: motionPrompt,
                                            })
                                          }
                                        >
                                          {isSlotRegenerating ? (
                                            <>
                                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                              Regenerating…
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                              Regenerate
                                            </>
                                          )}
                                        </Button>
                                        {gifUrl ? (
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="mt-2 h-9 w-full shrink-0 rounded-lg border border-emerald-700/80 bg-emerald-950/50 text-emerald-100 hover:bg-emerald-900/40"
                                            onClick={() => onDownload(gifUrl)}
                                          >
                                            <Download className="mr-2 h-3.5 w-3.5" />
                                            Download GIF
                                          </Button>
                                        ) : (
                                          <Button
                                            type="button"
                                            variant="secondary"
                                            size="sm"
                                            className="mt-2 h-9 w-full shrink-0 rounded-lg border border-zinc-600 bg-zinc-800/90 text-zinc-100 hover:bg-zinc-700"
                                            disabled={
                                              isExpressionVideosLoading ||
                                              isSlotRegenerating ||
                                              gifBusy
                                            }
                                            onClick={() =>
                                              onConvertVideoToGif(videoUrl)
                                            }
                                          >
                                            {gifBusy ? (
                                              <>
                                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                                Converting…
                                              </>
                                            ) : (
                                              <>
                                                <Film className="mr-2 h-3.5 w-3.5" />
                                                Convert to GIF
                                              </>
                                            )}
                                          </Button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </>
                        )}
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
