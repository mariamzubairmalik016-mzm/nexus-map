import { lazy } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import MainLayout from "../Layouts/MainLayout";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";

// Route-level code splitting — each page is its own chunk, loaded on demand
// (Suspense boundary lives in MainLayout).
const Home = lazy(() => import("../Pages/Home/Home"));
const Explore = lazy(() => import("../Pages/Explore/Explore"));
const MapPage = lazy(() => import("../Pages/Map/MapPage"));
const Community = lazy(() => import("../Pages/Community/Community"));
const RoadAlerts = lazy(() => import("../Pages/RoadAlerts/RoadAlerts"));
const Login = lazy(() => import("../Pages/Auth/Login"));
const Signup = lazy(() => import("../Pages/Auth/Signup"));
const ForgotPassword = lazy(() => import("../Pages/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("../Pages/Auth/ResetPassword"));
const Dashboard = lazy(() => import("../Pages/Dashboard/Dashboard"));
const Profile = lazy(() => import("../Pages/Profile/Profile"));
const Favorites = lazy(() => import("../Pages/Favorites/Favorites"));
const History = lazy(() => import("../Pages/History/History"));
const Notifications = lazy(() => import("../Pages/Notifications/Notifications"));
const OfflineMaps = lazy(() => import("../Pages/OfflineMaps/OfflineMaps"));
const AIPlanner = lazy(() => import("../Pages/AIPlanner/AIPlanner"));
const Settings = lazy(() => import("../Pages/Settings/Settings"));
const AdminDashboard = lazy(() => import("../Pages/Admin/AdminDashboard"));
const NotFound = lazy(() => import("../Pages/NotFound/NotFound"));

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/community" element={<Community />} />
        <Route path="/road-alerts" element={<RoadAlerts />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/history" element={<History />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/offline-maps" element={<OfflineMaps />} />
          <Route path="/ai-planner" element={<AIPlanner />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRoutes;
