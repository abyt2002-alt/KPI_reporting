import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { UploadPage } from './modules/UploadPage';
import { SummaryPage } from './modules/SummaryPage';
import { CampaignAssessmentPage } from './modules/CampaignAssessmentPage';
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
          {activeTab === "summary" ? <SummaryPage /> : null}
          {activeTab === "campaign_assessment" ? <CampaignAssessmentPage /> : null}
          {activeTab === "roas_playground" ? <RoasPlaygroundPage /> : null}
          {activeTab === "upload" ? <UploadPage /> : null}
        </main>
      </div>
    </div>
  );
}

export default App;
