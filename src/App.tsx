import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { useEffect } from 'react';
import { UploadPage } from './modules/UploadPage';
import { SummaryPage } from './modules/SummaryPage';
import { CampaignAssessmentPage } from './modules/CampaignAssessmentPage';
import { CrossPlatformAnalysisPage } from './modules/CrossPlatformAnalysisPage';
import { useStore } from './store/useStore';

function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  useEffect(() => {
    if (activeTab === "roas_playground") {
      setActiveTab("summary");
    }
  }, [activeTab, setActiveTab]);

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <div style={{ display: activeTab === "summary" ? "block" : "none" }}>
            <SummaryPage />
          </div>
          <div style={{ display: activeTab === "cross_platform_analysis" ? "block" : "none" }}>
            <CrossPlatformAnalysisPage />
          </div>
          <div style={{ display: activeTab === "campaign_assessment" ? "block" : "none" }}>
            <CampaignAssessmentPage />
          </div>
          <div style={{ display: activeTab === "upload" ? "block" : "none" }}>
            <UploadPage />
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
