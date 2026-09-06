import { Recycle, ScanSearch, Truck } from "lucide-react";

const STEPS = [
  {
    icon: Truck,
    title: "Collect",
    body: "Households and partners book pickups. Dispatch assigns routes, slots, and live job status across the city.",
  },
  {
    icon: ScanSearch,
    title: "Sort",
    body: "Bags move through MRF and AI segregation with a waste passport that records every custody step.",
  },
  {
    icon: Recycle,
    title: "Recover",
    body: "Sellable streams return to the market. Cities and operators see diversion, recovery, and CO₂e in one place.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-2xl space-y-3">
        <p className="font-medium text-primary text-sm">How it works</p>
        <h2 className="font-semibold text-3xl tracking-tight">From kerbside to recovered material</h2>
        <p className="text-muted-foreground">
          One operating system for collection crews, recovery facilities, and government oversight.
        </p>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="rounded-2xl border p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="text-muted-foreground text-sm">0{index + 1}</span>
              </div>
              <h3 className="font-semibold text-lg">{step.title}</h3>
              <p className="mt-2 text-muted-foreground text-sm">{step.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
