"use client";

import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border p-4 shadow-lg animate-in slide-in-from-bottom-5 fade-in-0",
            t.variant === "destructive"
              ? "border-red-500/50 bg-red-950 text-red-100"
              : "border-border bg-card text-card-foreground"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {t.title && (
                <p className="text-sm font-semibold">{t.title}</p>
              )}
              {t.description && (
                <p className="text-sm opacity-90 mt-1">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
