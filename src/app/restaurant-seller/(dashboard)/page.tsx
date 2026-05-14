export default function RestaurantDashboardPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-slate-500 mt-1">Welcome back to your restaurant partner panel.</p>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Outlets", value: "0", icon: "🍳" },
          { label: "Total Orders", value: "0", icon: "📦" },
          { label: "Revenue", value: "$0.00", icon: "💰" },
          { label: "Avg Rating", value: "N/A", icon: "⭐" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">{stat.label}</div>
            <div className="text-3xl font-bold mt-1 text-slate-900">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-emerald-50 border border-emerald-100 p-8 rounded-[2.5rem] text-center">
        <h2 className="text-2xl font-bold text-emerald-900">Partner Registration Complete!</h2>
        <p className="text-emerald-700 mt-2 max-w-lg mx-auto">
          Your account is currently being reviewed by our administration team. You will be notified via email once your account is fully activated.
        </p>
      </div>
    </div>
  )
}
