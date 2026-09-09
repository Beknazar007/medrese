import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./Layout";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";
import AssignmentsPage from "./pages/AssignmentsPage";
import DashboardPage from "./pages/DashboardPage";
import DepartmentsPage from "./pages/DepartmentsPage";
import FacultiesPage from "./pages/FacultiesPage";
import GroupsPage from "./pages/GroupsPage";
import RoomsPage from "./pages/RoomsPage";
import ScheduleGridPage from "./pages/ScheduleGridPage";
import SemestersPage from "./pages/SemestersPage";
import StudentsPage from "./pages/StudentsPage";
import SubjectsPage from "./pages/SubjectsPage";
import TeachersPage from "./pages/TeachersPage";
import TeacherMonitoringPage from "./pages/TeacherMonitoringPage";
import TeacherClassPage from "./pages/teacher/TeacherClassPage";
import TimeSlotsPage from "./pages/TimeSlotsPage";
import UsersPage from "./pages/UsersPage";
import { theme } from "./theme";

const queryClient = new QueryClient();

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
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
                  path="/faculties"
                  element={
                    <RoleRoute roles={["RECTOR"]}>
                      <FacultiesPage />
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
                <Route path="/schedule" element={<ScheduleGridPage />} />
                <Route path="*" element={<Navigate to="/schedule" replace />} />
              </Route>
            </Routes>
          </Router>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
