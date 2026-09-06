"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteProduct,
  uploadProductImage,
  upsertProduct,
  type UnifiedProductRow,
} from "@/server/wasty-actions";

export const SHOP_CATEGORIES = ["Home", "Kitchen", "Garden", "Fashion", "Stationery", "Personal care"] as const;

export const PRODUCT_ICONS = [
  "cube-outline",
  "home-outline",
  "restaurant-outline",
  "leaf-outline",
  "shirt-outline",
  "book-outline",
  "sparkles-outline",
  "flower-outline",
  "water-outline",
  "bag-outline",
  "cafe-outline",
  "phone-portrait-outline",
  "body-outline",
] as const;

export const PRODUCT_BADGES = ["", "Bestseller", "New", "Deal", "Limited", "Top rated", "Garden pick", "Premium"];

export const ACCENTS = ["#E8F6EE", "#E8EEF6", "#F6F0E8", "#F6E8EE", "#E8F0E6", "#F3F1E8"];

export type ProductDraft = {
  id: string;
  name: string;
  priceValue: string;
  mrp: string;
  category: string;
  description: string;
  stock: string;
  ecoPoints: string;
  icon: string;
  accent: string;
  badge: string;
  featured: boolean;
  unit: string;
  material: string;
  brand: string;
  seller: string;
  rating: string;
  reviews: string;
  imageUrl: string;
  inStock: boolean;
  returnDays: string;
  highlights: string;
};

export function emptyDraft(): ProductDraft {
  return {
    id: "",
    name: "",
    priceValue: "149",
    mrp: "149",
    category: "Home",
    description: "",
    stock: "50",
    ecoPoints: "20",
    icon: "cube-outline",
    accent: "#E8F6EE",
    badge: "",
    featured: false,
    unit: "",
    material: "",
    brand: "Wasty Co.",
    seller: "Wasty Eco Store",
    rating: "4.5",
    reviews: "0",
    imageUrl: "",
    inStock: true,
    returnDays: "7",
    highlights: "",
  };
}

export function rowToDraft(row: UnifiedProductRow): ProductDraft {
  return {
    id: row.id,
    name: row.name,
    priceValue: String(row.priceValue || row.price || 0),
    mrp: String(row.mrp || row.priceValue || row.price || 0),
    category: row.category || "Home",
    description: row.description,
    stock: String(row.stock),
    ecoPoints: String(row.ecoPoints),
    icon: row.icon || "cube-outline",
    accent: row.accent || "#E8F6EE",
    badge: row.badge,
    featured: row.featured,
    unit: row.unit,
    material: row.material,
    brand: row.brand,
    seller: row.seller,
    rating: String(row.rating),
    reviews: String(row.reviews),
    imageUrl: row.imageUrl,
    inStock: row.inStock,
    returnDays: String(row.returnDays),
    highlights: row.highlights.join("\n"),
  };
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function ProductEditor({
  open,
  product,
  provider,
  onOpenChange,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  product: UnifiedProductRow | null;
  provider: "sqlite" | "firebase" | "aws";
  onOpenChange: (open: boolean) => void;
  onSaved: (row: UnifiedProductRow) => void;
  onDeleted: (id: string) => void;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setDraft(product ? rowToDraft(product) : emptyDraft());
  }, [product, open]);

  const selling = Number(draft.priceValue) || 0;
  const list = Number(draft.mrp) || selling;
  const off = list > selling ? Math.round(((list - selling) / list) * 100) : 0;

  const canSave = useMemo(() => draft.name.trim().length > 0 && selling > 0, [draft.name, selling]);

  function patch<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUpload(file: File) {
    const productId = draft.id || `p${Date.now()}`;
    if (!draft.id) patch("id", productId);
    setUploading(true);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("productId", productId);
      const result = await uploadProductImage(form);
      patch("imageUrl", result.url);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!canSave) {
      toast.error("Name and selling price are required");
      return;
    }
    if (provider === "sqlite") {
      toast.error("Connect Firebase or AWS to save products to the shop catalog");
      return;
    }
    setSaving(true);
    try {
      const highlights = draft.highlights
        .split(/\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      const result = await upsertProduct({
        id: draft.id || undefined,
        name: draft.name,
        priceValue: selling,
        mrp: list,
        category: draft.category,
        description: draft.description,
        stock: Number(draft.stock) || 0,
        ecoPoints: Number(draft.ecoPoints) || 0,
        icon: draft.icon,
        accent: draft.accent,
        badge: draft.badge,
        featured: draft.featured,
        unit: draft.unit,
        material: draft.material,
        brand: draft.brand,
        seller: draft.seller,
        rating: Number(draft.rating) || 4.5,
        reviews: Number(draft.reviews) || 0,
        imageUrl: draft.imageUrl,
        inStock: draft.inStock,
        returnDays: Number(draft.returnDays) || 7,
        highlights,
      });
      onSaved({
        id: result.id,
        name: draft.name.trim(),
        price: selling,
        priceValue: selling,
        mrp: list,
        stock: Number(draft.stock) || 0,
        category: draft.category,
        description: draft.description,
        ecoPoints: Number(draft.ecoPoints) || 0,
        icon: draft.icon,
        accent: draft.accent,
        badge: draft.badge,
        featured: draft.featured,
        unit: draft.unit,
        material: draft.material,
        brand: draft.brand,
        seller: draft.seller,
        rating: Number(draft.rating) || 4.5,
        reviews: Number(draft.reviews) || 0,
        imageUrl: draft.imageUrl,
        inStock: draft.inStock && (Number(draft.stock) || 0) > 0,
        returnDays: Number(draft.returnDays) || 7,
        highlights,
        active: draft.inStock,
      });
      toast.success(product ? "Product updated — live in the user app shop" : "Product listed in the user app shop");
      onOpenChange(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft.id) return;
    if (!window.confirm(`Remove ${draft.name || draft.id} from the shop? Cart lines for this id will disappear.`)) {
      return;
    }
    setSaving(true);
    try {
      await deleteProduct(draft.id);
      onDeleted(draft.id);
      toast.success("Product removed from catalog");
      onOpenChange(false);
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{product ? "Edit product" : "List a product"}</SheetTitle>
          <SheetDescription>
            Writes Firestore <code>products/{"{id}"}</code> — the same document the user app shop, cart, and{" "}
            <code>placeOrder</code> read.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-5 px-4 pb-4">
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40">
              {draft.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <ImagePlus className="size-6" />
                  <span className="text-xs">{uploading ? "Uploading…" : "Upload image"}</span>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploading || provider === "sqlite"}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file);
                  event.target.value = "";
                }}
              />
            </label>
            <div className="grid gap-3">
              <Field label="Name" hint="Shown on shop cards, detail, and order line items">
                <Input value={draft.name} onChange={(e) => patch("name", e.target.value)} placeholder="Recycled Notebook" />
              </Field>
              <Field label="Category">
                <Select value={draft.category} onValueChange={(value) => patch("category", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHOP_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Selling price (₹)" hint="priceValue — what checkout charges">
              <Input type="number" min="1" value={draft.priceValue} onChange={(e) => patch("priceValue", e.target.value)} />
            </Field>
            <Field label="MRP (₹)" hint={off > 0 ? `${off}% off in the app` : "Same as price = no fake discount"}>
              <Input type="number" min="0" value={draft.mrp} onChange={(e) => patch("mrp", e.target.value)} />
            </Field>
            <Field label="Eco points" hint="Credited per unit on placeOrder">
              <Input type="number" min="0" value={draft.ecoPoints} onChange={(e) => patch("ecoPoints", e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Stock" hint="placeOrder decrements this number">
              <Input type="number" min="0" value={draft.stock} onChange={(e) => patch("stock", e.target.value)} />
            </Field>
            <Field label="Unit" hint="e.g. Pack of 4, 80 pages">
              <Input value={draft.unit} onChange={(e) => patch("unit", e.target.value)} placeholder="1 unit" />
            </Field>
            <Field label="Return days">
              <Input type="number" min="0" value={draft.returnDays} onChange={(e) => patch("returnDays", e.target.value)} />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => patch("description", e.target.value)}
              placeholder="What the customer sees on the product page"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Material">
              <Input value={draft.material} onChange={(e) => patch("material", e.target.value)} placeholder="100% recycled paper" />
            </Field>
            <Field label="Badge">
              <Select value={draft.badge || "__none"} onValueChange={(value) => patch("badge", value === "__none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_BADGES.map((badge) => (
                    <SelectItem key={badge || "none"} value={badge || "__none"}>
                      {badge || "None"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Brand">
              <Input value={draft.brand} onChange={(e) => patch("brand", e.target.value)} />
            </Field>
            <Field label="Seller">
              <Input value={draft.seller} onChange={(e) => patch("seller", e.target.value)} />
            </Field>
          </div>

          <Field label="Highlights" hint="One per line — shown on the product page">
            <Textarea
              rows={3}
              value={draft.highlights}
              onChange={(e) => patch("highlights", e.target.value)}
              placeholder={"100% recycled paper\nPlastic-free packaging\nEarn +20 eco points"}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Icon (Ionicons fallback)">
              <Select value={draft.icon} onValueChange={(value) => patch("icon", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_ICONS.map((icon) => (
                    <SelectItem key={icon} value={icon}>
                      {icon}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rating">
              <Input type="number" min="0" max="5" step="0.1" value={draft.rating} onChange={(e) => patch("rating", e.target.value)} />
            </Field>
            <Field label="Review count">
              <Input type="number" min="0" value={draft.reviews} onChange={(e) => patch("reviews", e.target.value)} />
            </Field>
          </div>

          <Field label="Card accent">
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => patch("accent", color)}
                  className="size-7 rounded-full border"
                  style={{
                    background: color,
                    outline: draft.accent === color ? "2px solid var(--primary)" : undefined,
                    outlineOffset: 2,
                  }}
                  aria-label={color}
                />
              ))}
            </div>
          </Field>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft.featured} onCheckedChange={(checked) => patch("featured", checked)} />
              Featured on shop home
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={draft.inStock} onCheckedChange={(checked) => patch("inStock", checked)} />
              In stock
            </label>
          </div>

          {draft.id ? <p className="text-[11px] text-muted-foreground">Document id: {draft.id}</p> : null}
        </div>

        <SheetFooter className="flex-row justify-between gap-2">
          {product ? (
            <Button type="button" variant="outline" onClick={() => void handleDelete()} disabled={saving}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving || !canSave}>
              {saving ? "Saving…" : product ? "Update product" : "List product"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
