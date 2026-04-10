import { FileText } from "lucide-react";
import { LockedResults } from "../components/LockedResults";
import { useStore } from "../store/useStore";

export function ReportsPage() {
  const { savedReports } = useStore();
  
  return (
    <div className="p-6 h-full overflow-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <FileText className="text-[#FFBD59]" /> Reports
      </h2>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button className="px-4 py-2 text-sm font-medium text-gray-700 border-b-2 border-[#FFBD59] bg-[#FFF8ED]">
          Current Report
        </button>
        <button className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700">
          Saved Reports ({savedReports.length})
        </button>
      </div>

      {/* Locked Content */}
      <LockedResults feature="Reports" />
    </div>
  );
}
