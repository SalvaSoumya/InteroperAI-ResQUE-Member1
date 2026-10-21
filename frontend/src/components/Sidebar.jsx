import {
  LayoutDashboard,
  Upload,
  ShieldCheck,
  GitBranch,
  Activity,
  BarChart3,
} from "lucide-react";

const menuItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: LayoutDashboard,
  },
  {
    name: "Upload Data",
    path: "/upload",
    icon: Upload,
  },
  {
    name: "Data Validation",
    path: "/validation",
    icon: ShieldCheck,
  },
  {
    name: "Data Integration",
    path: "/integration",
    icon: GitBranch,
  },
  {
    name: "Job Status",
    path: "/job-status",
    icon: Activity,
  },
  {
    name: "Results",
    path: "/results",
    icon: BarChart3,
  },
];

function Sidebar() {
  const currentPath = window.location.pathname;

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-slate-200 bg-white">
      {/* Logo */}
      <div className="flex h-20 items-center border-b border-slate-200 px-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
          <Activity size={22} />
        </div>

        <div className="ml-3">
          <h1 className="text-lg font-bold text-slate-900">
            InteroperAI-ResQ
          </h1>
          <p className="text-xs text-slate-500">
            Disaster Response Platform
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-4 py-6">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Main Menu
        </p>

        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPath === item.path;

            return (
              <a
                key={item.name}
                href={item.path}
                className={`flex items-center rounded-xl px-3 py-3 text-sm font-medium transition ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={19} className="mr-3" />
                {item.name}
              </a>
            );
          })}
        </div>
      </nav>

      {/* System Status */}
      <div className="absolute bottom-6 left-4 right-4 rounded-xl bg-slate-50 p-4">
        <div className="flex items-center">
          <span className="mr-2 h-2.5 w-2.5 rounded-full bg-green-500"></span>
          <span className="text-sm font-medium text-slate-700">
            System Online
          </span>
        </div>

        <p className="mt-1 text-xs text-slate-500">
          API services operational
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;