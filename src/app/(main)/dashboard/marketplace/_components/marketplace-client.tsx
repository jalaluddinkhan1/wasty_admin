"use client";

import { useEffect, useMemo, useState } from "react";

import { Leaf, Package, Plus, Star, Wallet } from "lucide-react";

import { ExportCsvButton } from "@/components/action-dialog-button";
import { PageHeader } from "@/components/page-header";
import { StatCards } from "@/components/stat-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { UnifiedProductRow } from "@/server/wasty-actions";

import { ProductEditor, SHOP_CATEGORIES } from "./product-editor";

function discountOf(row: UnifiedProductRow) {
  if (!row.mrp || row.mrp <= row.priceValue) return 0;
  return Math.round(((row.mrp - row.priceValue) / row.mrp) * 100);
}

export function MarketplaceClient({
  initialProducts,
  provider,
}: {
  initialProducts: UnifiedProductRow[];
  provider: "sqlite" | "firebase" | "aws";
}) {
  const [rows, setRows] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<UnifiedProductRow | null>(null);

  useEffect(() => {
    setRows(initialProducts);
  }, [initialProducts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (category !== "all" && row.category !== category) return false;
      if (!q) return true;
      return [row.name, row.category, row.brand, row.description, row.material].join(" ").toLowerCase().includes(q);
    });
  }, [rows, query, category]);

  const inStock = rows.filter((row) => row.inStock && row.stock > 0).length;
  const featured = rows.filter((row) => row.featured).length;
  const lowStock = rows.filter((row) => row.stock > 0 && row.stock <= 5).length;

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(row: UnifiedProductRow) {
    setEditing(row);
    setEditorOpen(true);
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Product Shop"
        description={
          provider !== "sqlite"
            ? "Live catalog for the user app marketplace tab. Products sync via GET/POST /v1/products."
            : "Connect Firebase or AWS (WASTY_DATA_PROVIDER=aws) to list products the user app can sell."
        }
        actions={
          <>
            <ExportCsvButton
              label="Export"
              filename="wasty-products.csv"
              headers={["id", "name", "category", "price", "mrp", "stock", "ecoPoints", "featured", "badge"]}
              rows={rows.map((row) => [
                row.id,
                row.name,
                row.category,
                String(row.priceValue),
                String(row.mrp),
                String(row.stock),
                String(row.ecoPoints),
                row.featured ? "yes" : "no",
                row.badge,
              ])}
            />
            <Button type="button" onClick={openCreate}>
              <Plus className="size-4" />
              Add product
            </Button>
          </>
        }
      />

      <StatCards
        items={[
          { title: "Listed", value: String(rows.length), hint: "Firestore products", icon: Package },
          { title: "In stock", value: String(inStock), hint: lowStock ? `${lowStock} low (≤5)` : "Ready to sell", icon: Leaf },
          { title: "Featured", value: String(featured), hint: "Shop home rail", icon: Star },
          {
            title: "Avg eco points",
            value: rows.length ? String(Math.round(rows.reduce((sum, row) => sum + row.ecoPoints, 0) / rows.length)) : "0",
            hint: "Per unit on order",
            icon: Wallet,
          },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, brand, material…"
          className="sm:max-w-sm"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {SHOP_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {rows.length === 0
              ? "No products yet. Add one — it appears in the user app shop immediately."
              : "No products match this search."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => {
            const off = discountOf(row);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => openEdit(row)}
                className="rounded-xl border bg-card text-left shadow-xs transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl" style={{ background: row.accent || "#E8F6EE" }}>
                  {row.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.imageUrl} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
                      No image · {row.icon}
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                    {row.featured ? <Badge>Featured</Badge> : null}
                    {row.badge ? <Badge variant="secondary">{row.badge}</Badge> : null}
                    {off >= 15 ? <Badge variant="destructive">{off}% off</Badge> : null}
                  </div>
                </div>
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.category}
                        {row.unit ? ` · ${row.unit}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold tabular-nums">₹{row.priceValue}</p>
                      {off > 0 ? <p className="text-[11px] text-muted-foreground line-through">₹{row.mrp}</p> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{row.inStock && row.stock > 0 ? `${row.stock} in stock` : "Out of stock"}</span>
                    <span>·</span>
                    <span>+{row.ecoPoints} pts</span>
                    <span>·</span>
                    <span>
                      {row.rating.toFixed(1)} ({row.reviews})
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <ProductEditor
        open={editorOpen}
        product={editing}
        provider={provider}
        onOpenChange={setEditorOpen}
        onSaved={(next) => {
          setRows((prev) => {
            const index = prev.findIndex((row) => row.id === next.id);
            if (index >= 0) {
              const copy = [...prev];
              copy[index] = next;
              return copy;
            }
            return [next, ...prev];
          });
        }}
        onDeleted={(id) => setRows((prev) => prev.filter((row) => row.id !== id))}
      />
    </div>
  );
}
