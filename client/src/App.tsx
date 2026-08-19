import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import AuthPage from "@/pages/AuthPage";
import Dashboard from "@/pages/Dashboard";
import PatientsPage from "@/pages/PatientsPage";
import PatientDetailPage from "@/pages/PatientDetailPage";
import StudiesPage from "@/pages/StudiesPage";
import NewStudyPage from "@/pages/NewStudyPage";
import StudyViewerPage from "@/pages/StudyViewerPage";
import AnalysisPage from "@/pages/AnalysisPage";
import SettingsPage from "@/pages/SettingsPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import { ClinicianRouteGuard } from "@/hooks/useClinicianAuth";
import Home from "@/pages/Home";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/app">{() => <ClinicianRouteGuard><Dashboard /></ClinicianRouteGuard>}</Route>
    <Route path="/dashboard">{() => <ClinicianRouteGuard><Dashboard /></ClinicianRouteGuard>}</Route>
    <Route path="/patients">{() => <ClinicianRouteGuard><PatientsPage /></ClinicianRouteGuard>}</Route>
    <Route path="/patients/:id">{() => <ClinicianRouteGuard><PatientDetailPage /></ClinicianRouteGuard>}</Route>
    <Route path="/studies/new">{() => <ClinicianRouteGuard><NewStudyPage /></ClinicianRouteGuard>}</Route>
    <Route path="/studies">{() => <ClinicianRouteGuard><StudiesPage /></ClinicianRouteGuard>}</Route>
    <Route path="/studies/:id">{() => <ClinicianRouteGuard><StudyViewerPage /></ClinicianRouteGuard>}</Route>
    <Route path="/analysis">{() => <ClinicianRouteGuard><AnalysisPage /></ClinicianRouteGuard>}</Route>
    <Route path="/settings">{() => <ClinicianRouteGuard><SettingsPage /></ClinicianRouteGuard>}</Route>
    <Route path="/login">{() => <AuthPage mode="login" />}</Route>
    <Route path="/signup">{() => <AuthPage mode="signup" />}</Route>
    <Route path="/forgot-password" component={ForgotPasswordPage} />
    <Route path="/reset-password" component={ResetPasswordPage} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="dark"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
