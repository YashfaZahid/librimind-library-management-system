import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { RequireAuth } from "../auth/RequireAuth";
import { LoadingState } from "../components/ui/LoadingState";
import { AdminLayout } from "../layouts/AdminLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { StudentLayout } from "../layouts/StudentLayout";
import NotFoundPage from "../pages/NotFoundPage";
import RouteErrorPage from "../pages/RouteErrorPage";

function lazyPage(factory: () => Promise<{ default: ComponentType }>) {
  const Page = lazy(factory);
  return function SuspendedPage() {
    return (
      <Suspense fallback={<LoadingState />}>
        <Page />
      </Suspense>
    );
  };
}

const LoginPage = lazyPage(() => import("../pages/auth/LoginPage"));
const RegisterPage = lazyPage(() => import("../pages/auth/RegisterPage"));
const HomePage = lazyPage(() => import("../pages/student/HomePage"));
const BookRoomPage = lazyPage(() => import("../pages/student/BookRoomPage"));
const BookPage = lazyPage(() => import("../pages/student/BookPage"));
const DigitalPage = lazyPage(() => import("../pages/student/DigitalPage"));
const ReaderPage = lazyPage(() => import("../pages/student/ReaderPage"));
const CollectionPage = lazyPage(() => import("../pages/student/CollectionPage"));
const AssistantPage = lazyPage(() => import("../pages/student/AssistantPage"));
const RecommendationsPage = lazyPage(() => import("../pages/student/RecommendationsPage"));
const LoansPage = lazyPage(() => import("../pages/student/LoansPage"));
const ProfilePage = lazyPage(() => import("../pages/student/ProfilePage"));
const DeskPage = lazyPage(() => import("../pages/admin/DeskPage"));
const AdminCataloguePage = lazyPage(() => import("../pages/admin/AdminCataloguePage"));
const CirculationPage = lazyPage(() => import("../pages/admin/CirculationPage"));
const AdminDigitalPage = lazyPage(() => import("../pages/admin/AdminDigitalPage"));
const ReadersPage = lazyPage(() => import("../pages/admin/ReadersPage"));
const SourcesPage = lazyPage(() => import("../pages/admin/SourcesPage"));
const InsightsPage = lazyPage(() => import("../pages/admin/InsightsPage"));
const AnalyticsPage = lazyPage(() => import("../pages/admin/AnalyticsPage"));
const EvaluationPage = lazyPage(() => import("../pages/admin/EvaluationPage"));

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/login" replace /> },
  {
    element: <AuthLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
    ],
  },
  {
    path: "/library",
    element: (
      <RequireAuth allow="member">
        <StudentLayout />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "shelf", element: <BookRoomPage /> },
      { path: "stacks", element: <Navigate to="/library/shelf" replace /> },
      { path: "catalogue", element: <Navigate to="/library/shelf" replace /> },
      { path: "discover", element: <Navigate to="/library/shelf" replace /> },
      { path: "wording", element: <Navigate to="/library/shelf" replace /> },
      { path: "books/:bookId", element: <BookPage /> },
      { path: "digital", element: <DigitalPage /> },
      { path: "digital/:assetId", element: <ReaderPage /> },
      { path: "collection", element: <CollectionPage /> },
      { path: "assistant", element: <AssistantPage /> },
      { path: "for-you", element: <RecommendationsPage /> },
      { path: "loans", element: <LoansPage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
  {
    path: "/admin",
    element: (
      <RequireAuth allow="admin">
        <AdminLayout />
      </RequireAuth>
    ),
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <DeskPage /> },
      { path: "shelf", element: <BookRoomPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "catalogue", element: <AdminCataloguePage /> },
      { path: "digital", element: <AdminDigitalPage /> },
      { path: "digital/:assetId", element: <ReaderPage /> },
      { path: "circulation", element: <CirculationPage /> },
      { path: "readers", element: <ReadersPage /> },
      { path: "sources", element: <SourcesPage /> },
      { path: "assistant", element: <AssistantPage /> },
      { path: "insights", element: <InsightsPage /> },
      { path: "evaluation", element: <EvaluationPage /> },
      { path: "books/:bookId", element: <BookPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
