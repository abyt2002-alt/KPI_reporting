import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { UploadPage } from './modules/UploadPage';
import { SummaryPage } from './modules/SummaryPage';
import { CampaignAssessmentPage } from './modules/CampaignAssessmentPage';
import { CrossPlatformAnalysisPage } from './modules/CrossPlatformAnalysisPage';
import { RoasPlaygroundPage } from './modules/RoasPlaygroundPage';
import { LoginPage } from './modules/LoginPage';
import { useStore } from './store/useStore';

function App() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const login = useStore((s) => s.login);
  const activeTab = useStore((s) => s.activeTab);

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-auto">
          <div style={{ display: activeTab === "summary" ? "block" : "none" }}>
            <SummaryPage />
          </div>
          <div style={{ display: activeTab === "campaign_assessment" ? "block" : "none" }}>
            <CampaignAssessmentPage />
          </div>
          <div style={{ display: activeTab === "cross_platform_analysis" ? "block" : "none" }}>
            <CrossPlatformAnalysisPage />
          </div>
          <div style={{ display: activeTab === "roas_playground" ? "block" : "none" }}>
            <RoasPlaygroundPage />
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
