export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 flex-col items-center justify-center p-24">
        <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
          <h1 className="text-4xl font-bold mb-4">
            Welcome to Coforma Studio
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Advisory-as-a-Service Platform for Customer Advisory Boards
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg">
              <h2 className="text-2xl font-semibold mb-2">Getting Started</h2>
              <p className="text-gray-600">
                The infrastructure is ready. Implementation is in progress.
              </p>
            </div>
            <div className="p-6 border rounded-lg">
              <h2 className="text-2xl font-semibold mb-2">Documentation</h2>
              <p className="text-gray-600">
                Check the README.md and docs/ directory for more information.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-8">
        <div className="mx-auto max-w-5xl">
          {/* Ecosystem links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-gray-500">
            <a href="https://selva.town" className="hover:text-gray-900 transition-colors">Selva</a>
            <span className="text-gray-300" aria-hidden="true">&middot;</span>
            <a href="https://forj.design" className="hover:text-gray-900 transition-colors">Forj</a>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Coforma Studio. By{' '}
              <a href="https://madfam.io" className="text-gray-600 hover:text-gray-900 transition-colors">Innovaciones MADFAM</a>.
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <a href="https://madfam.io/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</a>
              <span className="text-gray-300" aria-hidden="true">&middot;</span>
              <a href="https://madfam.io/terms" className="hover:text-gray-600 transition-colors">Terms of Service</a>
              <span className="text-gray-300" aria-hidden="true">&middot;</span>
              <a href="https://status.madfam.io" className="hover:text-gray-600 transition-colors">Status</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
