"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/api-client";
import { toast } from "@/hooks/use-toast";

interface CameraAngleModalProps {
  imageUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (newImageUrl: string) => void;
}

export function CameraAngleModal({
  imageUrl,
  open,
  onOpenChange,
  onResult,
}: CameraAngleModalProps) {
  const [horizontalAngle, setHorizontalAngle] = useState(0);
  const [verticalAngle, setVerticalAngle] = useState(0);
  const [distance, setDistance] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApply = async () => {
    setIsProcessing(true);
    try {
      const result = await apiRequest<{ imageUrl: string }>(
        "/api/change-camera-angle",
        {
          method: "POST",
          body: JSON.stringify({
            imageUrl,
            horizontalAngle,
            verticalAngle,
            distance,
          }),
        }
      );
      onResult(result.imageUrl);
    } catch (error) {
      toast({
        title: "Camera angle failed",
        description:
          error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Adjust Camera Angle</DialogTitle>
          <DialogDescription>
            Change the viewing angle of your character image.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Preview"
              className="w-48 h-48 object-cover rounded-lg border border-gray-700"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Horizontal Angle</Label>
                <span className="text-sm text-muted-foreground">
                  {horizontalAngle}°
                </span>
              </div>
              <Slider
                value={[horizontalAngle]}
                onValueChange={([v]) => setHorizontalAngle(v)}
                min={0}
                max={359}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Vertical Angle</Label>
                <span className="text-sm text-muted-foreground">
                  {verticalAngle}°
                </span>
              </div>
              <Slider
                value={[verticalAngle]}
                onValueChange={([v]) => setVerticalAngle(v)}
                min={-30}
                max={60}
                step={1}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Distance</Label>
                <span className="text-sm text-muted-foreground">
                  {distance.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[distance]}
                onValueChange={([v]) => setDistance(v)}
                min={0}
                max={2}
                step={0.1}
              />
            </div>
          </div>

          <Button
            onClick={handleApply}
            disabled={isProcessing}
            className="floating-button w-full py-4"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Apply Camera Angle"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
