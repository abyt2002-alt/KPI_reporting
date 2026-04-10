import { Lock } from "lucide-react";

interface ComingSoonProps {
  feature: string;
}

export function ComingSoon({ feature }: ComingSoonProps) {
  return (
    <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center max-w-md px-8">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl">
          <Lock size={40} className="text-amber-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-800 mb-3">Workspace Preview</h2>
        <p className="text-lg text-slate-600 mb-2">
          {feature} will appear here once the KPI reporting stack expands.
        </p>
        <p className="text-sm text-slate-500">
          The ingestion flow is live now and the rest of the shell is staged for later rollout.
        </p>
      </div>
    </div>
  );
}
