import { useState, type ElementType, type FormEvent } from "react";
import {
  LogIn,
  User,
  Mail,
  AlertCircle,
  Loader2,
  BarChart3,
  Layers3,
  Database,
  Clock3,
  Activity,
  Target,
  Globe2,
  ShoppingCart,
  Megaphone,
} from "lucide-react";

interface LoginPageProps {
  onLogin: (user: { id: number; email: string; name: string }) => void;
}

function FeatureCard({ icon: Icon, title, desc, color }: { icon: ElementType; title: string; desc: string; color: string }) {
  return (
    <div className="group p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-slate-900/40 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300 backdrop-blur-md hover:bg-gradient-to-br hover:from-cyan-950/60 hover:to-slate-900/60">
      <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-3 shadow-lg`}>
        <Icon size={22} className="text-white" />
      </div>
      <h3 className="text-white font-semibold mb-2 text-sm">{title}</h3>
      <p className="text-gray-200 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name || !email) {
      setError("Please fill in all fields");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Invalid email");
      return;
    }

    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      onLogin({
        id: Date.now(),
        email,
        name,
      });
    }, 500);
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[58%] bg-gradient-to-br from-slate-950 via-cyan-950/30 to-slate-950 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-cyan-500/8 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] bg-cyan-500/5 rounded-full blur-[150px]" />

        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-10 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Target size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">KPI Reporting</h1>
              <p className="text-cyan-300 text-xs font-medium">Unified ingestion and reporting workspace</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center py-8">
            <div className="mb-8">
              <div className="inline-block mb-4 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30">
                <p className="text-cyan-200 font-medium text-xs tracking-wide uppercase">Data operations</p>
              </div>
              <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-5">
                Bring every channel
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-emerald-400 to-cyan-300">
                  into one KPI layer.
                </span>
              </h2>
              <p className="text-slate-300 text-base max-w-xl leading-relaxed">
                A polished intake experience for Google Ads, Google Analytics, Meta Ads, and Shopify with backend ingestion and a report-ready preview.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <FeatureCard
                icon={Database}
                title="Source validation"
                desc="Check the required columns before pushing data downstream."
                color="bg-gradient-to-br from-cyan-500 to-cyan-600"
              />
              <FeatureCard
                icon={Clock3}
                title="Date controls"
                desc="Lock the exact extraction window for each source."
                color="bg-gradient-to-br from-emerald-500 to-emerald-600"
              />
              <FeatureCard
                icon={Activity}
                title="Operational KPI layer"
                desc="Build a unified batch that is ready for reporting and dashboards."
                color="bg-gradient-to-br from-amber-500 to-orange-500"
              />
              <FeatureCard
                icon={Layers3}
                title="Multi-source flow"
                desc="Move between Ads, Analytics, Meta, and Shopify without changing the layout."
                color="bg-gradient-to-br from-fuchsia-500 to-pink-500"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-white/10">
            <p className="text-slate-400 text-xs mb-5 uppercase tracking-wider font-semibold">Connectors</p>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <BarChart3 size={18} />
                <span className="text-sm font-medium text-white">Google Ads</span>
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <Globe2 size={18} />
                <span className="text-sm font-medium text-white">Analytics</span>
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <Megaphone size={18} />
                <span className="text-sm font-medium text-white">Meta Ads</span>
              </div>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20">
                <ShoppingCart size={18} />
                <span className="text-sm font-medium text-white">Shopify</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-black relative overflow-hidden">
        <video autoPlay muted loop className="absolute inset-0 w-full h-full object-cover opacity-100">
          <source src="/background.mp4" type="video/mp4" />
        </video>
        <div className="w-full max-w-md relative z-10">
          <div className="lg:hidden text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-emerald-500 rounded-xl flex items-center justify-center">
                <Target size={24} className="text-white" />
              </div>
              <div className="text-left">
                <h1 className="text-2xl font-bold text-gray-900">KPI Reporting</h1>
                <p className="text-cyan-600 text-xs font-medium">Unified ingestion and reporting workspace</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="relative w-12 h-12 rounded-lg bg-black shadow-lg flex items-center justify-center overflow-hidden border border-gray-800">
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-400/10 to-emerald-500/20"></div>
                <Target size={24} className="text-cyan-400 relative z-10" />
              </div>
              <div className="flex flex-col">
                <span className="text-base font-semibold text-gray-700">Access the KPI reporting workspace</span>
                <span className="text-xs text-gray-400 font-mono">Demo login for the ingestion flow</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-500 mb-8">Enter your name and email to open the ingestion demo.</p>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center gap-3 text-red-700">
                <AlertCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full pl-12 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <LogIn size={20} />}
                {loading ? "Opening workspace..." : "Enter workspace"}
              </button>
            </form>

            <div className="mt-8 grid grid-cols-2 gap-3 text-[12px] text-gray-500">
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="font-semibold text-gray-700">4 sources</div>
                <div className="mt-1">Google, Meta, and Shopify flows</div>
              </div>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                <div className="font-semibold text-gray-700">Backend demo</div>
                <div className="mt-1">Date range and column ingestion</div>
              </div>
            </div>
          </div>

          <p className="text-center text-gray-400 text-sm mt-6">© 2026 Quant Matrix AI. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
