import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Zap,
  Video,
  FileText,
  Calendar,
  MessageSquare,
  BarChart3,
  Settings,
  LogOut,
  User,
  Scissors,
  Loader2,
  Menu,
  X,
} from "lucide-react";
import useUser from "@/utils/useUser";
import useAuth from "@/utils/useAuth";
import useScheduledPublisher from "@/utils/useScheduledPublisher";
import { BackgroundTaskProvider, useBackgroundTasks } from "@/utils/backgroundTasks";
import { applyPlanToCurrentUser, getPlanFromSearch, getPlanLabel, getUserPlan, isPaidPlan } from "@/utils/plans";
import { Toaster } from "sonner";

const queryClient = new QueryClient();

const SidebarItem = ({ icon: Icon, label, href, active, onClick }) => (
  <Link
    to={href}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
      active
        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
        : "text-gray-400 hover:bg-white/5 hover:text-white"
    }`}
  >
    <Icon
      size={20}
      className={active ? "text-white" : "group-hover:text-white"}
    />
    <span className="font-medium">{label}</span>
  </Link>
);

function ClientLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const { data: user, loading, refetch } = useUser();
  const { signOut } = useAuth();
  const tasks = useBackgroundTasks();
  const runningTasks = Object.values(tasks).filter((task) => task.status === "running");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  useScheduledPublisher(user);

  const noLayoutPages = [
    "/",
    "/account/signin",
    "/account/signup",
    "/account/logout",
    "/billing/checkout",
    "/billing/success",
  ];
  const isLandingPage = noLayoutPages.includes(pathname);

  useEffect(() => {
    if (!pathname || isLandingPage || loading || user) return;

    navigate(`/account/signin?callbackUrl=${encodeURIComponent(pathname)}`, {
      replace: true,
    });
  }, [isLandingPage, loading, navigate, pathname, user]);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const selectedPlan = getPlanFromSearch(location.search);
    if (
      !selectedPlan ||
      !user ||
      isPaidPlan(selectedPlan) ||
      getUserPlan(user) === selectedPlan
    ) {
      return;
    }

    applyPlanToCurrentUser(selectedPlan)
      .then(() => refetch())
      .finally(() => {
        navigate(pathname, { replace: true });
      });
  }, [location.search, navigate, pathname, refetch, user]);

  if (isLandingPage) {
    return <>{children}</>;
  }

  if (!loading && !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#0A0B14] text-white">
        Redirecting...
      </div>
    );
  }

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  const sidebarContent = (
    <>
        <div className="mb-10 flex items-center justify-between gap-3 px-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-600/20">
              S
            </div>
            <span className="truncate text-xl font-bold tracking-tight">
              Socialoraa
            </span>
          </div>
          <button
            type="button"
            onClick={closeMobileSidebar}
            aria-label="Close navigation"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-gray-300 md:hidden"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar">
          <SidebarItem
            icon={LayoutDashboard}
            label="Dashboard"
            href="/dashboard"
            active={pathname === "/dashboard"}
            onClick={closeMobileSidebar}
          />

          <div className="py-4">
            <span className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Content
            </span>
            <div className="mt-2 space-y-1">
              <SidebarItem
                icon={Zap}
                label="Post Generator"
                href="/dashboard/post-generator"
                active={pathname === "/dashboard/post-generator"}
                onClick={closeMobileSidebar}
              />
              <SidebarItem
                icon={FileText}
                label="Content Writer"
                href="/dashboard/content-writer"
                active={pathname === "/dashboard/content-writer"}
                onClick={closeMobileSidebar}
              />
              <SidebarItem
                icon={Video}
                label="Script Generator"
                href="/dashboard/script-generator"
                active={pathname === "/dashboard/script-generator"}
                onClick={closeMobileSidebar}
              />
              <SidebarItem
                icon={FileText}
                label="My Work"
                href="/dashboard/my-work"
                active={pathname === "/dashboard/my-work"}
                onClick={closeMobileSidebar}
              />
            </div>
          </div>

          <div className="py-4">
            <span className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Automation
            </span>
            <div className="mt-2 space-y-1">
              <SidebarItem
                icon={Scissors}
                label="Video to Shorts"
                href="/dashboard/video-shorts"
                active={pathname === "/dashboard/video-shorts"}
                onClick={closeMobileSidebar}
              />
              <SidebarItem
                icon={Calendar}
                label="Post Scheduler"
                href="/dashboard/scheduler"
                active={pathname === "/dashboard/scheduler"}
                onClick={closeMobileSidebar}
              />
              <SidebarItem
                icon={MessageSquare}
                label="Auto Reply"
                href="/dashboard/auto-reply"
                active={pathname === "/dashboard/auto-reply"}
                onClick={closeMobileSidebar}
              />
            </div>
          </div>

          <div className="py-4">
            <span className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Business
            </span>
            <div className="mt-2 space-y-1">
              <SidebarItem
                icon={BarChart3}
                label="Analytics"
                href="/dashboard/analytics"
                active={pathname === "/dashboard/analytics"}
                onClick={closeMobileSidebar}
              />
              <SidebarItem
                icon={Settings}
                label="Settings"
                href="/dashboard/settings"
                active={pathname === "/dashboard/settings"}
                onClick={closeMobileSidebar}
              />
            </div>
          </div>
        </nav>

        {/* User Profile Footer */}
        <div className="mt-auto pt-6 border-t border-white/5">
          {loading ? (
            <div className="h-12 w-full bg-white/5 animate-pulse rounded-xl" />
          ) : user ? (
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-600/30 flex items-center justify-center text-blue-400 font-bold overflow-hidden">
                  {user.image ? (
                    <img
                      src={user.image}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    (user.name || user.email)[0].toUpperCase()
                  )}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold truncate w-32">
                    {user.name || "User"}
                  </span>
                  <span className="mt-0.5 w-fit rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-400">
                    {getPlanLabel(user.plan)}
                  </span>
                  <span className="text-xs text-gray-500 truncate w-32">
                    {user.email}
                  </span>
                </div>
              </div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
              >
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link
              to="/account/signin"
              onClick={closeMobileSidebar}
              className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all text-gray-400 hover:text-white"
            >
              <User size={20} />
              <span className="font-medium">Sign In</span>
            </Link>
          )}
        </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#0A0B14] text-white">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/5 bg-[#0A0B14]/95 px-4 backdrop-blur md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-lg shadow-blue-600/20">
            S
          </div>
          <span className="text-lg font-bold tracking-tight">Socialoraa</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileSidebarOpen((open) => !open)}
          aria-label={mobileSidebarOpen ? "Close navigation" : "Open navigation"}
          className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white transition-colors hover:bg-white/10"
        >
          {mobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={closeMobileSidebar}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[min(82vw,18rem)] flex-col border-r border-white/5 bg-[#0A0B14] p-5 transition-transform duration-300 md:w-72 md:translate-x-0 md:p-6 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Main Content Area */}
      <main className="min-h-screen relative md:ml-72">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:p-8">{children}</div>
      </main>

      {runningTasks.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-[60] rounded-2xl border border-blue-500/20 bg-[#101322]/95 px-4 py-3 text-sm text-blue-100 shadow-2xl shadow-blue-950/30 backdrop-blur sm:left-auto sm:right-5 sm:max-w-sm">
          <div className="flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-blue-300" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Processing in background</p>
            <p className="text-xs text-blue-100/70">
              {runningTasks[0].message || "You can switch features safely."}
            </p>
          </div>
            {typeof runningTasks[0].progress === "number" && (
              <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-xs font-black text-blue-200">
                {Math.round(runningTasks[0].progress)}%
              </span>
            )}
          </div>
          {typeof runningTasks[0].progress === "number" && (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-300 transition-all duration-500"
                style={{ width: `${Math.min(Math.max(runningTasks[0].progress, 0), 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <QueryClientProvider client={queryClient}>
          <BackgroundTaskProvider>
            <ClientLayout>{children}</ClientLayout>
          </BackgroundTaskProvider>
          <Toaster position="top-right" theme="dark" richColors />
        </QueryClientProvider>
      </body>
    </html>
  );
}
