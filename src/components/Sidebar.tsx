import { BarChart3, Calculator, Database, Rocket, Target } from "lucide-react";
import { useStore } from "../store/useStore";

export function Sidebar() {
  const activeTab = useStore((state) => state.activeTab);
  const setActiveTab = useStore((state) => state.setActiveTab);

  const isUpload = activeTab === "upload";
  const isSummary = activeTab === "summary";
  const isCampaignAssessment = activeTab === "campaign_assessment";
  const isRoasPlayground = activeTab === "roas_playground";

  return (
    <aside className="w-64 bg-slate-950 text-white flex flex-col h-full shadow-2xl border-r border-white/5">
      <div className="p-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-11 h-11 bg-gradient-to-br from-cyan-400 via-sky-500 to-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25 relative shrink-0">
          <Target size={22} className="text-white" />
          <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-300 rounded-full animate-pulse" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-cyan-300/90">Workflow</p>
          <p className="text-base font-semibold text-white">KPI Reporting</p>
        </div>
      </div>

      <div className="px-3 py-4 space-y-2">
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
            isUpload
              ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_10px_24px_rgba(6,182,212,0.2)]"
              : "border-white/10 bg-white/[0.04] hover:border-white/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-lg p-2 ${isUpload ? "bg-cyan-500/25 text-cyan-200" : "bg-white/10 text-slate-200"}`}>
              <Database size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Ingestion</p>
              <p className="text-xs text-slate-400">Source configuration</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("summary")}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
            isSummary
              ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_10px_24px_rgba(6,182,212,0.2)]"
              : "border-white/10 bg-white/[0.04] hover:border-white/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-lg p-2 ${isSummary ? "bg-cyan-500/25 text-cyan-200" : "bg-white/10 text-slate-200"}`}>
              <BarChart3 size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Summary</p>
              <p className="text-xs text-slate-400">KPI overview</p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("campaign_assessment")}
          className={`w-full rounded-xl border px-3 py-3 text-left transition ${
            isCampaignAssessment
              ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_10px_24px_rgba(6,182,212,0.2)]"
              : "border-white/10 bg-white/[0.04] hover:border-white/20"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-lg p-2 ${isCampaignAssessment ? "bg-cyan-500/25 text-cyan-200" : "bg-white/10 text-slate-200"}`}>
              <Rocket size={16} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Campaign Assessment</p>
              <p className="text-xs text-slate-400">Lift and scenario view</p>
            </div>
          </div>
        </button>

      </div>

      <div className="mt-auto p-3">
        <button
          type="button"
          onClick={() => setActiveTab("roas_playground")}
          className={`w-full rounded-2xl border px-3 py-2.5 text-left transition ${
            isRoasPlayground
              ? "border-cyan-400/50 bg-cyan-500/15 shadow-[0_10px_24px_rgba(6,182,212,0.2)]"
              : "border-white/10 bg-white/[0.03] hover:border-white/20"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2 ${isRoasPlayground ? "bg-cyan-500/25 text-cyan-200" : "bg-white/10 text-slate-200"}`}>
              <Calculator size={15} />
            </div>
            <p className="min-w-0 truncate text-sm font-semibold text-white">ROAS Playground</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
