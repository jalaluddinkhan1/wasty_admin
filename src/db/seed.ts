import { count } from "drizzle-orm";
import type { SQLJsDatabase } from "drizzle-orm/sql-js";

import * as schema from "./schema";

type Db = SQLJsDatabase<typeof schema>;

export function seedIfEmpty(db: Db) {
  const [{ value: pickupCount }] = db.select({ value: count() }).from(schema.pickups).all();
  if (pickupCount > 0) return;

  const now = new Date();

  db.insert(schema.pickups)
    .values([
      {
        id: "PK-1042",
        userName: "Aisha Khan",
        slot: "Today · 10:00–12:00",
        partner: "Ravi",
        waste: "Dry recyclables",
        status: "on the way",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "PK-1040",
        userName: "Green Cafe",
        slot: "Today · 08:00–10:00",
        partner: "Meera",
        waste: "Mixed",
        status: "complete",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "PK-1037",
        userName: "Nikhil Rao",
        slot: "Today · 14:00–16:00",
        partner: "—",
        waste: "E-waste",
        status: "scheduled",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "PK-1033",
        userName: "Priya Shah",
        slot: "Yesterday",
        partner: "Anil",
        waste: "Dry",
        status: "cancelled",
        createdAt: now,
        updatedAt: now,
      },
    ])
    .run();

  db.insert(schema.partners)
    .values([
      {
        id: "1",
        name: "Ravi Kumar",
        role: "Driver",
        zone: "Indiranagar",
        status: "online",
        kyc: "approved",
        rating: "4.8",
        createdAt: now,
      },
      {
        id: "2",
        name: "Meera Joshi",
        role: "Collector",
        zone: "Koramangala",
        status: "on break",
        kyc: "approved",
        rating: "4.6",
        createdAt: now,
      },
      {
        id: "3",
        name: "Anil Das",
        role: "Driver",
        zone: "HSR Layout",
        status: "offline",
        kyc: "pending",
        rating: "—",
        createdAt: now,
      },
      {
        id: "4",
        name: "Team Alpha",
        role: "Team lead",
        zone: "Whitefield",
        status: "online",
        kyc: "approved",
        rating: "4.9",
        createdAt: now,
      },
    ])
    .run();

  db.insert(schema.bags)
    .values([
      {
        id: "1",
        code: "WSTY-BAG-88421",
        batch: "B-2026-07",
        userName: "Aisha Khan",
        category: "Dry · 2.4 kg",
        status: "active",
        createdAt: now,
      },
      {
        id: "2",
        code: "WSTY-BAG-88422",
        batch: "B-2026-07",
        userName: "—",
        category: "—",
        status: "unassigned",
        createdAt: now,
      },
      {
        id: "3",
        code: "WSTY-BAG-87910",
        batch: "B-2026-06",
        userName: "Green Cafe",
        category: "Mixed · 8.1 kg",
        status: "collected",
        createdAt: now,
      },
      {
        id: "4",
        code: "WSTY-BAG-87102",
        batch: "B-2026-06",
        userName: "Nikhil Rao",
        category: "Flagged",
        status: "contaminated",
        createdAt: now,
      },
    ])
    .run();

  db.insert(schema.supportTickets)
    .values([
      {
        id: "SOS-12",
        type: "SOS",
        fromLabel: "Anil · Partner",
        summary: "Vehicle breakdown near Dump Yard 2",
        status: "urgent",
        createdAt: now,
      },
      {
        id: "TK-441",
        type: "Ticket",
        fromLabel: "Aisha · User",
        summary: "Points not credited after completed pickup",
        status: "open",
        createdAt: now,
      },
      {
        id: "INC-88",
        type: "Incident",
        fromLabel: "Meera · Partner",
        summary: "Contamination in bag WSTY-BAG-87102",
        status: "reviewing",
        createdAt: now,
      },
      {
        id: "TK-438",
        type: "Report issue",
        fromLabel: "Nikhil · User",
        summary: "Missed pickup yesterday — no partner arrived",
        status: "resolved",
        createdAt: now,
      },
    ])
    .run();

  db.insert(schema.featureFlags)
    .values([
      { key: "demo", value: "true", updatedAt: now },
      { key: "marketplace", value: "true", updatedAt: now },
      { key: "instantPayout", value: "false", updatedAt: now },
      { key: "classifier", value: "true", updatedAt: now },
      { key: "partnerMin", value: "1.4.0", updatedAt: now },
      { key: "userMin", value: "2.1.0", updatedAt: now },
      { key: "dataProvider", value: "sqlite", updatedAt: now },
    ])
    .run();
}
