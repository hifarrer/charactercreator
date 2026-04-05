import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const aspectRatioToSize: Record<string, string> = {
  "1:1": "1024*1024",
  "16:9": "1280*720",
  "9:16": "720*1280",
  "4:3": "1152*864",
  "3:4": "864*1152",
};

export const seedreamI2ISizeMap: Record<string, string> = {
  "1:1": "2048*2048",
  "16:9": "2560*1440",
  "9:16": "1440*2560",
  "4:3": "2304*1728",
  "3:4": "1728*2304",
};

export const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  "1:1": "1:1 (Square)",
  "16:9": "16:9 (Landscape)",
  "9:16": "9:16 (Portrait)",
  "4:3": "4:3",
  "3:4": "3:4",
};
