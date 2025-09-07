export default function Loading() {
  return (
    <main className="container mx-auto p-6 grid md:grid-cols-[15rem_1fr] gap-6">
      <div className="hidden md:block" />
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted rounded" />
        <div className="grid gap-2 md:grid-cols-[1fr_12rem_12rem_1fr_1fr_auto]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
        <div className="bg-card border border-border rounded">
          <div className="h-10 bg-muted border-b border-border" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 border-b border-border last:border-b-0" />
          ))}
        </div>
      </div>
    </main>
  )
}

