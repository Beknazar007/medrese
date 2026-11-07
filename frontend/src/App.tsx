import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import Layout from "./Layout";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import { theme } from "./theme";

// Each page is its own chunk: a teacher no longer downloads the rector's dashboard, schedule
// editor, etc. on first open. Layout shows a thin progress bar while a page chunk loads.
const AssignmentsPage = lazy(() => import("./pages/AssignmentsPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const DepartmentsPage = lazy(() => import("./pages/DepartmentsPage"));
const GroupsPage = lazy(() => import("./pages/GroupsPage"));
const RoomsPage = lazy(() => import("./pages/RoomsPage"));
const ScheduleGridPage = lazy(() => import("./pages/ScheduleGridPage"));
const SemestersPage = lazy(() => import("./pages/SemestersPage"));
const StudentsPage = lazy(() => import("./pages/StudentsPage"));
const ExcusesPage = lazy(() => import("./pages/ExcusesPage"));
const SubjectsPage = lazy(() => import("./pages/SubjectsPage"));
const TeachersPage = lazy(() => import("./pages/TeachersPage"));
const TeacherMonitoringPage = lazy(() => import("./pages/TeacherMonitoringPage"));
const TeacherClassPage = lazy(() => import("./pages/teacher/TeacherClassPage"));
const HifzJournalPage = lazy(() => import("./pages/teacher/HifzJournalPage"));
const TimeSlotsPage = lazy(() => import("./pages/TimeSlotsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));

const queryClient = new QueryClient();

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ConfirmProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }
              >
                <Route
                  path="/dashboard"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <DashboardPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/departments"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <DepartmentsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/users"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <UsersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/teachers"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <TeachersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/subjects"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <SubjectsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/groups"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <GroupsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/assignments"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <AssignmentsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/semesters"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <SemestersPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/rooms"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <RoomsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/timeslots"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <TimeSlotsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/students"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <StudentsPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/excuses"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <ExcusesPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/monitoring"
                  element={
                    <RoleRoute roles={["RECTOR", "DEAN"]}>
                      <TeacherMonitoringPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/my-class"
                  element={
                    <RoleRoute roles={["TEACHER"]}>
                      <TeacherClassPage />
                    </RoleRoute>
                  }
                />
                <Route
                  path="/hifz-journal"
                  element={
                    <RoleRoute roles={["TEACHER", "RECTOR", "DEAN"]}>
                      <HifzJournalPage />
                    </RoleRoute>
                  }
                />
                <Route path="/schedule" element={<ScheduleGridPage />} />
                <Route path="*" element={<Navigate to="/schedule" replace />} />
              </Route>
            </Routes>
          </Router>
          </ConfirmProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
