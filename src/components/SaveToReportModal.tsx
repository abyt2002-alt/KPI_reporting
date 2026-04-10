import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, Save, MessageSquare, Check } from "lucide-react";
import { toPng } from "html-to-image";
import { useStore } from "../store/useStore";

interface SaveModalData {
  targetRef: React.RefObject<HTMLElement | null>;
  title: string;
  type: "chart" | "table" | "metrics";
}

interface SaveModalContextType {
  openSaveModal: (data: SaveModalData) => void;
}

const SaveModalContext = createContext<SaveModalContextType | null>(null);

export function useSaveModal() {
  const context = useContext(SaveModalContext);
  if (!context) {
    throw new Error("useSaveModal must be used within SaveModalProvider");
  }
  return context;
}

export function SaveModalProvider({ children }: { children: ReactNode }) {
  const { addToCurrentReport } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const [modalData, setModalData] = useState<SaveModalData | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const openSaveModal = useCallback((data: SaveModalData) => {
    setModalData(data);
    setComment("");
    setSaved(false);
    setIsOpen(true);
  }, []);

  const handleSave = async () => {
    if (!modalData?.targetRef.current || saving) return;

    setSaving(true);
    try {
      const imageData = await toPng(modalData.targetRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      });

      addToCurrentReport({
        id: crypto.randomUUID(),
        title: modalData.title,
        imageData,
        type: modalData.type,
        createdAt: new Date().toISOString(),
        comment: comment.trim() || undefined,
      });

      setSaved(true);
      setTimeout(() => {
        setIsOpen(false);
        setModalData(null);
        setComment("");
        setSaved(false);
      }, 1000);
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setIsOpen(false);
      setModalData(null);
      setComment("");
    }
  };

  return (
    <SaveModalContext.Provider value={{ openSaveModal }}>
      {children}

      {/* Save Modal */}
      {isOpen && modalData && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-amber-50 to-orange-50">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Save className="text-amber-500" size={20} />
                  Save to Reports
                </h3>
                <p className="text-sm text-slate-500 mt-0.5 truncate max-w-[280px]">
                  {modalData.title}
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={saving}
                className="p-2 hover:bg-white/50 rounded-lg transition disabled:opacity-50"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              {saved ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} className="text-green-600" />
                  </div>
                  <p className="text-lg font-semibold text-slate-800">
                    Saved to Reports!
                  </p>
                  <p className="text-sm text-slate-500 mt-1">
                    View it in the Reports section
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                      <MessageSquare size={16} className="text-slate-400" />
                      Add a comment (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Add notes about this chart or analysis..."
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none text-sm"
                      rows={3}
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg mb-4">
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        modalData.type === "chart"
                          ? "bg-purple-100 text-purple-700"
                          : modalData.type === "table"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {modalData.type}
                    </div>
                    <span className="text-sm text-slate-600 truncate flex-1">
                      {modalData.title}
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            {!saved && (
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={handleClose}
                  disabled={saving}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-medium hover:from-amber-600 hover:to-orange-600 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </SaveModalContext.Provider>
  );
}

// Simple save button that uses the modal
export function SaveButton({
  targetRef,
  title,
  type,
  className = "",
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  title: string;
  type: "chart" | "table" | "metrics";
  className?: string;
}) {
  const { openSaveModal } = useSaveModal();

  return (
    <button
      onClick={() => openSaveModal({ targetRef, title, type })}
      className={`px-2 py-1 text-xs rounded-lg font-medium transition flex items-center gap-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 ${className}`}
    >
      <Save size={12} />
      Save
    </button>
  );
}
