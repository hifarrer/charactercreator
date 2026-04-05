"use client";

import { useState, useEffect } from "react";
import { StandaloneCharacterCreator } from "@/components/standalone-character-creator";
import { getAuthToken, setAuthToken } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles } from "lucide-react";

export default function Home() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    const existing = getAuthToken();
    if (existing) {
      setHasToken(true);
      return;
    }
    const envToken = process.env.NEXT_PUBLIC_API_TOKEN;
    if (envToken) {
      setAuthToken(envToken);
      setHasToken(true);
      return;
    }
    setHasToken(false);
  }, []);

  const handleSetToken = () => {
    if (tokenInput.trim()) {
      setAuthToken(tokenInput.trim());
      setHasToken(true);
    }
  };

  if (hasToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!hasToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Sparkles className="h-12 w-12 text-pink-500 mx-auto" />
            <h1 className="text-3xl font-bold gradient-text">
              Character Creator
            </h1>
            <p className="text-muted-foreground">
              Enter your API token to get started.
            </p>
          </div>
          <div className="space-y-4 p-6 rounded-xl border border-gray-800 bg-gray-900/50">
            <div className="space-y-2">
              <Label htmlFor="token">API Token</Label>
              <Input
                id="token"
                type="password"
                placeholder="Paste your token..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSetToken();
                }}
                className="bg-gray-800 border-gray-700"
              />
            </div>
            <Button
              onClick={handleSetToken}
              disabled={!tokenInput.trim()}
              className="floating-button w-full"
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-black/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] items-center justify-end px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              localStorage.removeItem("auth_token");
              setHasToken(false);
            }}
            className="text-zinc-400 hover:text-white"
          >
            Sign out
          </Button>
        </div>
      </header>
      <main className="bg-black px-4 py-6 sm:px-6">
        <StandaloneCharacterCreator />
      </main>
    </div>
  );
}
