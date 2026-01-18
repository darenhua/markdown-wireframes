export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-4">Settings</h1>
      <p className="text-gray-400 mb-6">Configure your preferences here.</p>

      <div className="space-y-4 max-w-md">
        <div className="p-4 bg-gray-800 rounded-lg">
          <label className="flex items-center justify-between">
            <span className="text-gray-300">Dark Mode</span>
            <div className="w-12 h-6 bg-blue-600 rounded-full relative">
              <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </label>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <label className="flex items-center justify-between">
            <span className="text-gray-300">Notifications</span>
            <div className="w-12 h-6 bg-gray-600 rounded-full relative">
              <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
            </div>
          </label>
        </div>

        <div className="p-4 bg-gray-800 rounded-lg">
          <label className="block text-gray-300 mb-2">Language</label>
          <select className="w-full bg-gray-700 text-white rounded-md px-3 py-2 border border-gray-600">
            <option>English</option>
            <option>Spanish</option>
            <option>French</option>
          </select>
        </div>
      </div>
    </div>
  );
}
