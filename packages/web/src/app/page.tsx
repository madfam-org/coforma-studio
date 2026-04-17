export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Coforma Studio
        </h1>
        <p className="text-2xl text-muted-foreground mb-8">
          Advisory-as-a-Service Platform
        </p>
        <p className="text-lg max-w-2xl mx-auto mb-12">
          Transform your customer advisory boards into systematic growth engines.
          Build with your customers, not just for them.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/auth/signin"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
          >
            Sign In
          </a>
          <a
            href="/auth/signup"
            className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/80 transition"
          >
            Get Started
          </a>
        </div>
        <div className="mt-16 text-sm text-muted-foreground">
          <p>🚀 Status: Pre-Alpha | Built with ❤️ by Innovaciones MADFAM</p>
        </div>
      </div>
    </main>
  );
}
