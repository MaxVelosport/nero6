import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { ThemeProvider } from "@/lib/theme";

import LandingPage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import VerifyEmailPage from "@/pages/verify-email";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { PublicLayout } from "@/components/layout/PublicLayout";
import DashboardPage from "@/pages/dashboard";
import TasksPage from "@/pages/tasks/index";
import NewTaskPage from "@/pages/tasks/new";
import TaskDetailPage from "@/pages/tasks/[id]";
import ProfilePage from "@/pages/profile";
import HintsPage from "@/pages/hints";
import SessionsPage from "@/pages/sessions/index";
import NewSessionPage from "@/pages/sessions/new";
import SessionChatPage from "@/pages/sessions/[id]";
import CourseworkWizardPage from "@/pages/coursework/new";
import NewTicketsPage from "@/pages/tickets/new";
import SharedTaskPage from "@/pages/tasks/shared";
import SummaryPage from "@/pages/learn/summary";
import SubscriptionsPage from "@/pages/subscriptions";
import AdminPage from "@/pages/admin";
import LegalPage from "@/pages/legal";
import RefundRequestPage from "@/pages/refund-request";
import IllustrationsPage from "@/pages/illustrations/index";
import UniquenessPage from "@/pages/uniqueness";
import StatisticsPage from "@/pages/statistics";
import QuizPage from "@/pages/quiz";
import { SessionExpiredModal } from "@/components/session-expired-modal";
import { useTokenRefresh } from "@/hooks/useTokenRefresh";

// Configure API client auth
setAuthTokenGetter(() => localStorage.getItem("authToken"));

function dispatch401() {
  // Показываем модалку только если у пользователя был активный токен.
  // Иначе на публичных страницах (лендинг и т.п.) /api/auth/me даёт 401
  // и пугает гостя ложным «Сессия истекла».
  if (!localStorage.getItem("authToken")) return;
  window.dispatchEvent(new CustomEvent("auth:expired"));
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error: unknown) => {
      if ((error as any)?.status === 401) dispatch401();
    },
  }),
  mutationCache: new MutationCache({
    onError: (error: unknown) => {
      if ((error as any)?.status === 401) dispatch401();
    },
  }),
});

const PROTECTED_PREFIXES = [
  "/dashboard", "/tasks", "/profile", "/sessions", "/coursework",
  "/tickets", "/learn/summary", "/subscriptions", "/admin", "/illustrations",
  "/uniqueness", "/statistics", "/quiz",
];

function isProtectedPath(path: string) {
  return PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

function ProtectedSwitch() {
  return (
    <Switch>
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/tasks/new" component={NewTaskPage} />
      <Route path="/tasks/:id">{(p) => <TaskDetailPage params={p} />}</Route>
      <Route path="/tasks" component={TasksPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/sessions/new" component={NewSessionPage} />
      <Route path="/sessions/:id">{(p) => <SessionChatPage params={p} />}</Route>
      <Route path="/sessions" component={SessionsPage} />
      <Route path="/coursework/new" component={CourseworkWizardPage} />
      <Route path="/tickets/new" component={NewTicketsPage} />
      <Route path="/learn/summary" component={SummaryPage} />
      <Route path="/subscriptions" component={SubscriptionsPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/illustrations" component={IllustrationsPage} />
      <Route path="/uniqueness" component={UniquenessPage} />
      <Route path="/statistics" component={StatisticsPage} />
      <Route path="/quiz" component={QuizPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  const [location] = useLocation();
  const showDashboard = isProtectedPath(location);

  return (
    <>
      {showDashboard ? (
        <DashboardLayout>
          <ProtectedSwitch />
        </DashboardLayout>
      ) : (
        <Switch>
          <Route path="/" component={LandingPage} />
          <Route path="/login" component={LoginPage} />
          <Route path="/register" component={RegisterPage} />
          <Route path="/forgot-password" component={ForgotPasswordPage} />
          <Route path="/reset-password" component={ResetPasswordPage} />
          <Route path="/hints">{() => <PublicLayout><HintsPage /></PublicLayout>}</Route>
          <Route path="/tasks/shared/:id">{(p) => <SharedTaskPage params={p as any} />}</Route>
          <Route path="/verify-email" component={VerifyEmailPage} />
          <Route path="/terms">{() => <LegalPage type="terms" />}</Route>
          <Route path="/offer">{() => <LegalPage type="offer" />}</Route>
          <Route path="/oferta">{() => <LegalPage type="oferta" />}</Route>
          <Route path="/privacy">{() => <LegalPage type="privacy" />}</Route>
          <Route path="/refund">{() => <LegalPage type="refund" />}</Route>
          <Route path="/cookies">{() => <LegalPage type="cookies" />}</Route>
          <Route path="/ai-disclaimer">{() => <LegalPage type="ai-disclaimer" />}</Route>
          <Route path="/legal">{() => <LegalPage type="terms" />}</Route>
          <Route path="/refund-request" component={RefundRequestPage} />
          <Route path="/pricing">{() => { window.location.replace("/#pricing"); return null; }}</Route>
          <Route path="/faq">{() => { window.location.replace("/#faq"); return null; }}</Route>
          <Route path="/demo">{() => { window.location.replace("/#demo"); return null; }}</Route>
          <Route component={NotFound} />
        </Switch>
      )}
    </>
  );
}

function AppInner() {
  useTokenRefresh();
  return (
    <>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
      <Toaster />
      <SessionExpiredModal />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppInner />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
