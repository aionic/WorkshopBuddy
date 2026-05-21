"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete project "${projectName}"?\n\nThis permanently removes the project and ALL of its workshop inputs, agent runs, and artifacts. This action cannot be undone.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(body || `Delete failed (${res.status})`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-2">
      <Button
        variant="danger"
        onClick={handleDelete}
        disabled={isPending}
        aria-label={`Delete project ${projectName}`}
        title="Delete project"
      >
        <Trash2 className="w-4 h-4" />
        {isPending ? "Deleting…" : "Delete"}
      </Button>
      {error && <span className="text-xs text-red-300">{error}</span>}
    </div>
  );
}
