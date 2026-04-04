import { ExamplePosts } from "./example-posts";

export default function Home() {
  return (
    <main className="min-h-screen bg-black p-8">
      <h1 className="text-3xl font-bold text-white mb-2">Virality App</h1>
      <p className="text-zinc-400 mb-8">
        Shared components and types working from @clipper/shared-ui and
        @clipper/shared-types
      </p>
      <ExamplePosts />
    </main>
  );
}
