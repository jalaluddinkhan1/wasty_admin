const HIGHLIGHTS = [
  { value: "Cities", label: "Day-to-day progress, diversion, and audit trails" },
  { value: "Operators", label: "Jobs, partners, routes, and recovery in one console" },
  { value: "Communities", label: "QR-tracked bags and a clearer path for recyclables" },
];

export function ImpactHighlights() {
  return (
    <section id="impact" className="border-y bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 md:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <div key={item.value}>
            <p className="font-semibold text-2xl">{item.value}</p>
            <p className="mt-2 text-muted-foreground text-sm">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
