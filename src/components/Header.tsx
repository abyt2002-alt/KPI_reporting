import { User, LogOut, Moon, Sun, Monitor, Minimize2, Maximize2, ChevronDown, Check, CalendarDays, BarChart3 } from "lucide-react";
import { useStore } from "../store/useStore";
import { useState, useRef, useEffect } from "react";
import type { Theme, SummaryMarketFilter, SummaryTimeRange } from "../store/useStore";
import { FY25_END_DATE, FY25_START_DATE } from "../modules/summaryConfig";

const SUMMARY_TIME_OPTIONS: Array<{ value: SummaryTimeRange; label: string }> = [
  { value: "yesterday", label: "Yesterday" },
  { value: "last_7", label: "Last 7 days" },
  { value: "last_13", label: "Last 13 days" },
  { value: "last_30", label: "Last 30 days" },
  { value: "last_90", label: "Last 90 days" },
  { value: "last_180", label: "Last 180 days" },
  { value: "last_365", label: "Last 365 days" },
  { value: "custom", label: "Custom range" },
];

const SUMMARY_MARKET_OPTIONS: Array<{ value: SummaryMarketFilter; label: string }> = [
  { value: "all", label: "All markets" },
  { value: "US", label: "US" },
  { value: "UK", label: "UK" },
  { value: "UAE", label: "UAE" },
];

export function Header() {
  const {
    user,
    logout,
    theme,
    setTheme,
    compactMode,
    setCompactMode,
    activeTab,
    summaryTimeRange,
    summaryMarketFilter,
    summaryStartDate,
    summaryEndDate,
    setSummaryTimeRange,
    setSummaryMarketFilter,
    setSummaryDateRange,
  } = useStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
        setShowSettings(false);
      }
    };
    if (isMenuOpen || showSettings) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isMenuOpen, showSettings]);

  if (!user) return null;

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) {
      logout();
      setIsMenuOpen(false);
    }
  };

  const themeOptions: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "auto", label: "Auto", icon: Monitor },
  ];

  const isSummary = activeTab === "summary";
  const isRoasPlayground = activeTab === "roas_playground";
  const isCustomSummaryRange = isSummary && summaryTimeRange === "custom";

  const handleSummaryRangeChange = (value: SummaryTimeRange) => {
    setSummaryTimeRange(value);
    if (value === "custom") {
      const nextStart = summaryStartDate || FY25_START_DATE;
      const nextEnd = summaryEndDate || FY25_END_DATE;
      setSummaryDateRange(nextStart, nextEnd);
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {isSummary ? "Summary Workspace" : isRoasPlayground ? "ROAS Playground" : "Ingestion Workspace"}
            </h2>
            <p className="text-xs text-slate-500">
              {isSummary
                ? "Time/market KPI view with daily trend drill-downs"
                : isRoasPlayground
                  ? "Tool-style ROAS scenario testing and configuration"
                  : "Source setup and ingestion workflow connected to backend"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isSummary ? (
            <>
              <label className="group relative">
                <CalendarDays size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={summaryTimeRange}
                  onChange={(event) => handleSummaryRangeChange(event.target.value as SummaryTimeRange)}
                  className="appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                >
                  {SUMMARY_TIME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </label>

              {isCustomSummaryRange ? (
                <div className="flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-2 py-1 shadow-sm">
                  <input
                    type="date"
                    min={FY25_START_DATE}
                    max={summaryEndDate || FY25_END_DATE}
                    value={summaryStartDate}
                    onChange={(event) => {
                      const nextStart = event.target.value;
                      const adjustedEnd = nextStart > summaryEndDate ? nextStart : summaryEndDate;
                      setSummaryDateRange(nextStart, adjustedEnd);
                    }}
                    className="rounded-md border border-transparent px-1 py-1 text-xs text-slate-700 outline-none focus:border-cyan-300"
                  />
                  <span className="text-xs text-slate-500">to</span>
                  <input
                    type="date"
                    min={summaryStartDate || FY25_START_DATE}
                    max={FY25_END_DATE}
                    value={summaryEndDate}
                    onChange={(event) => {
                      const nextEnd = event.target.value;
                      const adjustedStart = nextEnd < summaryStartDate ? nextEnd : summaryStartDate;
                      setSummaryDateRange(adjustedStart, nextEnd);
                    }}
                    className="rounded-md border border-transparent px-1 py-1 text-xs text-slate-700 outline-none focus:border-cyan-300"
                  />
                </div>
              ) : null}

              <label className="group relative">
                <BarChart3 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <select
                  value={summaryMarketFilter}
                  onChange={(event) => setSummaryMarketFilter(event.target.value as SummaryMarketFilter)}
                  className="appearance-none rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-10 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-200"
                >
                  {SUMMARY_MARKET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </label>
            </>
          ) : null}

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-cyan-400 to-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <User size={18} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <ChevronDown size={18} className={`text-slate-400 transition-transform ${isMenuOpen ? "rotate-180" : ""}`} />
            </button>

            {isMenuOpen && !showSettings && (
              <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
                </div>
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setIsMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-slate-700 hover:bg-slate-50 transition-colors text-sm"
                >
                  <Moon size={16} />
                  <span>Appearance & Settings</span>
                </button>
                <div className="border-t border-slate-100 my-1"></div>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors text-sm">
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}

            {showSettings && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 py-2 z-50">
                <div className="px-4 py-3 border-b border-slate-100">
                  <button onClick={() => { setShowSettings(false); setIsMenuOpen(true); }} className="text-sm text-slate-500 hover:text-slate-700 mb-2">Back</button>
                  <p className="text-sm font-semibold text-slate-800">Appearance & Settings</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Theme</p>
                  <div className="space-y-1">
                    {themeOptions.map(({ value, label, icon: Icon }) => (
                      <button
                        key={value}
                        onClick={() => setTheme(value)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${theme === value ? "bg-cyan-50 text-cyan-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
                      >
                        <Icon size={16} />
                        <span className="flex-1 text-left">{label}</span>
                        {theme === value && <Check size={16} className="text-cyan-600" />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="border-t border-slate-100"></div>
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Display</p>
                  <button
                    onClick={() => setCompactMode(!compactMode)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${compactMode ? "bg-cyan-50 text-cyan-700 font-medium" : "text-slate-700 hover:bg-slate-50"}`}
                  >
                    {compactMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    <span className="flex-1 text-left">Compact Mode</span>
                    {compactMode && <Check size={16} className="text-cyan-600" />}
                  </button>
                </div>
                <div className="border-t border-slate-100 my-1"></div>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors text-sm">
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
