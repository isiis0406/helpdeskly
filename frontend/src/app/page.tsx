import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="bg-gradient-to-b from-platinum/30 to-white">
        <div className="container mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Helpdeskly — Le support client pour TPE/PME
            </h1>
            <p className="mt-4 text-muted-foreground text-lg">
              Centralisez vos tickets, automatisez vos workflows et restez en contact avec vos clients. Multi-tenant, sécurisé et scalable.
            </p>
            <div className="mt-8 flex gap-3">
              <Link href="/signup" className="px-5 py-3 rounded bg-primary text-primary-foreground hover:opacity-90">
                Essayer gratuitement
              </Link>
              <Link href="/auth/sign-in" className="px-5 py-3 rounded border border-border text-foreground hover:bg-muted">
                Se connecter
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] w-full rounded-xl bg-card shadow-md border border-border flex items-center justify-center text-muted-foreground">
              Aperçu du produit
            </div>
          </div>
        </div>
      </section>
      {/* Features */}
      <section className="container mx-auto px-6 py-16">
        <h2 className="text-2xl font-semibold mb-8">Fonctionnalités clés</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'Tickets intelligents', desc: 'Classement, tags, priorités et SLAs.' },
            { title: 'Automatisations', desc: 'Règles, notifications et workflows.' },
            { title: 'Multi-tenant', desc: 'Isolation par base, sécurité et performance.' },
          ].map((f, i) => (
            <div key={i} className="rounded-lg border border-border p-5 bg-card">
              <div className="font-medium">{f.title}</div>
              <div className="text-sm text-muted-foreground mt-2">{f.desc}</div>
            </div>
          ))}
        </div>
      </section>
      {/* CTA */}
      <section className="bg-platinum/30">
        <div className="container mx-auto px-6 py-10 flex items-center justify-between gap-6">
          <div>
            <div className="text-lg font-medium">Prêt à améliorer votre support client ?</div>
            <div className="text-muted-foreground">Créez votre workspace en quelques clics.</div>
          </div>
          <Link href="/signup" className="px-5 py-3 rounded bg-primary text-primary-foreground hover:opacity-90">Commencer</Link>
        </div>
      </section>
    </main>
  )
}
