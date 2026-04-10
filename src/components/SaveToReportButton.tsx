import { Save, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toPng } from "html-to-image";
import { useStore } from "../store/useStore";

interface SaveToReportButtonProps {
  targetRef: React.RefObject<HTMLElement | null>;
  title: string;
  type: 'chart' | 'table' | 'metrics';
  className?: string;
  size?: 'sm' | 'md';
}

export function SaveToReportButton({ targetRef, title, type, className = "", size = "sm" }: SaveToReportButtonProps) {
  const { addToCurrentReport } = useStore();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!targetRef.current || saving) return;
    
    setSaving(true);
    try {
      const imageData = await toPng(targetRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      
      addToCurrentReport({
        id: crypto.randomUUID(),
        title,
        imageData,
        type,
        createdAt: new Date().toISOString(),
      });
      
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save to report:", error);
    } finally {
      setSaving(false);
    }
  };

  const sizeClasses = size === "sm" 
    ? "px-2 py-1 text-xs gap-1" 
    : "px-3 py-1.5 text-sm gap-1.5";

  return (
    <button
      onClick={handleSave}
      disabled={saving}
      className={`flex items-center ${sizeClasses} rounded-lg font-medium transition ${
        saved
          ? "bg-green-100 text-green-700 border border-green-300"
          : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
      } ${className}`}
      title="Save to Reports"
    >
      {saving ? (
        <Loader2 size={size === "sm" ? 12 : 14} className="animate-spin" />
      ) : saved ? (
        <Check size={size === "sm" ? 12 : 14} />
      ) : (
        <Save size={size === "sm" ? 12 : 14} />
      )}
      {saved ? "Saved!" : "Save"}
    </button>
  );
}
