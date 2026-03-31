import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/auth/AuthGuard";
import ApprovalReview from "./pages/ApprovalReview";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AuthDemo from "./pages/AuthDemo";
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import AgentPage from "./pages/AgentPage";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import NewCampaign from "./pages/NewCampaign";
import Identities from "./pages/Identities";
import Approvals from "./pages/Approvals";
import Audit from "./pages/Audit";
import Governance from "./pages/Governance";
import Settings from "./pages/Settings";
import VideoLandingPage from "./pages/VideoLandingPage";
import DealIntelligence from "./pages/DealIntelligence";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/demo" element={<AuthDemo />} />
            <Route path="/lp/:campaignId" element={<VideoLandingPage />} />
            <Route path="/approve/:token" element={<ApprovalReview />} />
            <Route path="/app/onboarding" element={<AuthGuard requireOnboarding={false}><Onboarding /></AuthGuard>} />
            <Route path="/app/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/app/agent" element={<AuthGuard><AgentPage /></AuthGuard>} />
            <Route path="/app/campaigns" element={<AuthGuard><Campaigns /></AuthGuard>} />
            <Route path="/app/campaigns/new" element={<AuthGuard><NewCampaign /></AuthGuard>} />
            <Route path="/app/campaigns/:id" element={<AuthGuard><CampaignDetail /></AuthGuard>} />
            <Route path="/app/identities" element={<AuthGuard><Identities /></AuthGuard>} />
            <Route path="/app/approvals" element={<AuthGuard><Approvals /></AuthGuard>} />
            <Route path="/app/audit" element={<AuthGuard><Audit /></AuthGuard>} />
            <Route path="/app/deal-intelligence" element={<AuthGuard><DealIntelligence /></AuthGuard>} />
            <Route path="/app/governance" element={<AuthGuard><Governance /></AuthGuard>} />
            <Route path="/app/settings" element={<AuthGuard><Settings /></AuthGuard>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
