export default function DashboardPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-4">Dashboard</h1>
      <p className="text-gray-400 mb-6">Your analytics at a glance.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg">
          <p className="text-blue-200 text-sm">Total Users</p>
          <p className="text-3xl font-bold text-white">1,234</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-green-600 to-green-800 rounded-lg">
          <p className="text-green-200 text-sm">Revenue</p>
          <p className="text-3xl font-bold text-white">$45,678</p>
        </div>
        <div className="p-4 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg">
          <p className="text-purple-200 text-sm">Active Sessions</p>
          <p className="text-3xl font-bold text-white">89</p>
        </div>
      </div>

      <div className="p-4 bg-gray-800 rounded-lg">
        <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-gray-700 rounded">
              <div className="w-8 h-8 bg-gray-600 rounded-full" />
              <div>
                <p className="text-gray-300 text-sm">User {i} performed an action</p>
                <p className="text-gray-500 text-xs">{i} hour{i > 1 ? "s" : ""} ago</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
