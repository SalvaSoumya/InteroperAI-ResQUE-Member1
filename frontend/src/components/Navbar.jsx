import { Bell, UserCircle } from "lucide-react";

function Navbar() {
  return (
    <header className="fixed left-64 right-0 top-0 z-30 h-20 border-b border-slate-200 bg-white">
      <div className="flex h-full items-center justify-between px-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Disaster Data Integration
          </h2>

          <p className="text-sm text-slate-500">
            Prepare, validate and connect emergency-response data
          </p>
        </div>

        <div className="flex items-center gap-5">
          <button className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <Bell size={20} />

            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500"></span>
          </button>

          <div className="flex items-center gap-2">
            <UserCircle size={32} className="text-slate-400" />

            <div>
              <p className="text-sm font-semibold text-slate-800">
                Response Operator
              </p>

              <p className="text-xs text-slate-500">
                Data Integration Team
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;