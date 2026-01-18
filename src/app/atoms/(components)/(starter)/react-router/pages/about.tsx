export default function AboutPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-4">About</h1>
      <p className="text-gray-400 mb-4">
        This is the about page demonstrating React Router in a Next.js context.
      </p>
      <div className="space-y-4">
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold text-blue-400 mb-2">How it works</h2>
          <p className="text-gray-300">
            We use createMemoryRouter from react-router-dom to handle client-side routing
            within a Next.js page component.
          </p>
        </div>
        <div className="p-4 bg-gray-800 rounded-lg">
          <h2 className="text-xl font-semibold text-green-400 mb-2">Features</h2>
          <ul className="list-disc list-inside text-gray-300 space-y-1">
            <li>Client-side navigation</li>
            <li>State hoisting from navbar</li>
            <li>Dynamic route creation via server actions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
