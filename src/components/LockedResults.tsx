import { Lock, Mail } from "lucide-react";

interface LockedResultsProps {
  feature: string;
}

export function LockedResults({ feature }: LockedResultsProps) {
  return (
    <div className="flex items-center justify-center h-full min-h-[500px] bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border-2 border-dashed border-slate-300">
      <div className="text-center max-w-md px-8">
        <div className="mb-6 inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl shadow-lg">
          <Lock size={40} className="text-amber-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-3">
          Contact for Access
        </h3>
        <p className="text-base text-slate-600 mb-4">
          {feature} is available in the full version
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
          <Mail size={16} />
          <span>Reach out to your administrator</span>
        </div>
      </div>
    </div>
  );
}
