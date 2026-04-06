export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-50">
      <div className="flex flex-col items-center gap-6">
        {/* Logo / identity */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
            <span className="text-white font-extrabold text-lg">A</span>
          </div>
          <span className="text-2xl font-extrabold text-blue-500 tracking-wider">AdminOS</span>
        </div>

        {/* Progress bar */}
        <div className="w-48 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-loading-bar" />
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium tracking-widest uppercase">
          Ładowanie...
        </p>
      </div>

      <style>{`
        @keyframes loading-bar {
          0% { width: 0%; margin-left: 0; }
          50% { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
        .animate-loading-bar {
          animation: loading-bar 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
