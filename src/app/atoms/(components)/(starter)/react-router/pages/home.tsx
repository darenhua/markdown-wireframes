import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-4">Home</h1>
      <p className="text-gray-400">Welcome to the React Router demo. This is the home page.</p>
      <div className="mt-6 p-4 bg-gray-800 rounded-lg">
        <p className="text-gray-300">Navigate using the sidebar to explore different routes.</p>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={() => navigate("/dashboard")}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          Go to Dashboard
        </button>
        <button
          onClick={() => navigate("/about")}
          className="px-4 py-2 bg-gray-700 text-gray-200 rounded-md hover:bg-gray-600 transition-colors"
        >
          Learn About
        </button>
      </div>
    </div>
  );
}
