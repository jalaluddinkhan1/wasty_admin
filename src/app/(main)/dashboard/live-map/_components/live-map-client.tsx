"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";
import { GeoJSONSource, Map as MapLibreMap, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { PageHeader } from "@/components/page-header";
import { StatCards } from "@/components/stat-cards";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MAP_LAYERS,
  matchesMapLayer,
  matchesMapStatus,
  type LiveMapPoint,
  type LiveMapSnapshot,
  type MapLayerId,
  type MapStatusFilter,
} from "@/lib/live-map/types";
import { getLiveMapSnapshot } from "@/server/wasty-actions";
import { useSyncSince } from "@/lib/hooks/useSyncSince";
import { MapPinned, RefreshCw, Truck, Users, Warehouse } from "lucide-react";

const OPENFREEMAP = "https://tiles.openfreemap.org/styles/liberty";
const BENGALURU: [number, number] = [77.5946, 12.9716];

const OSM_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

function circlePolygon(lng: number, lat: number, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const latDelta = radiusM / 111_320;
  const lngDelta = radiusM / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  for (let i = 0; i <= steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    coords.push([lng + lngDelta * Math.cos(angle), lat + latDelta * Math.sin(angle)]);
  }
  return { type: "Polygon" as const, coordinates: [coords] };
}

function markerEl(point: LiveMapPoint) {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;cursor:pointer;";
  const size = point.kind === "alert" || (point.kind === "vehicle" && point.active) ? 22 : 18;
  const shape =
    point.kind === "pickup"
      ? `width:0;height:0;border-left:${size / 2}px solid transparent;border-right:${size / 2}px solid transparent;border-top:${size}px solid ${point.color};filter:drop-shadow(0 1px 2px #0006);`
      : point.kind === "vehicle"
        ? `width:${size}px;height:${size * 0.7}px;background:${point.color};border:2px solid #fff;border-radius:3px;box-shadow:0 0 0 3px ${point.color}55;`
        : point.kind === "user"
          ? `width:${size}px;height:${size}px;background:${point.color};border:2px solid #fff;transform:rotate(45deg);box-shadow:0 1px 3px #0005;`
          : point.kind === "bin"
            ? `width:${size}px;height:${size}px;background:${point.color};border:2px solid #fff;border-radius:4px;box-shadow:0 1px 3px #0005;`
            : `width:0;height:0;border-left:${size / 2}px solid transparent;border-right:${size / 2}px solid transparent;border-bottom:${size}px solid ${point.color};filter:drop-shadow(0 1px 2px #0006);`;
  wrap.innerHTML = `<span style="${shape}"></span>`;
  wrap.title = `${point.title} · ${point.kind}`;
  return wrap;
}

function radiiGeoJson(points: LiveMapPoint[]) {
  return {
    type: "FeatureCollection" as const,
    features: points
      .filter((p) => p.radiusM && (p.kind === "user" || p.kind === "vehicle"))
      .map((p) => ({
        type: "Feature" as const,
        properties: { color: p.color, kind: p.kind },
        geometry: circlePolygon(p.lng, p.lat, p.radiusM as number),
      })),
  };
}

export function LiveMapClient({
  snapshot: initial,
  provider,
}: {
  snapshot: LiveMapSnapshot;
  provider: "sqlite" | "firebase" | "aws";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const readyRef = useRef(false);
  const fittedKeyRef = useRef("");
  const [snapshot, setSnapshot] = useState(initial);
  const [layer, setLayer] = useState<MapLayerId>("all");
  const [status, setStatus] = useState<MapStatusFilter>("all");
  const [selected, setSelected] = useState<LiveMapPoint | null>(null);
  const [mapReady, setMapReady] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const visible = useMemo(
    () => snapshot.points.filter((p) => matchesMapLayer(p, layer) && matchesMapStatus(p, status)),
    [snapshot.points, layer, status],
  );

  const syncOverlays = useCallback((points: LiveMapPoint[]) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const data = radiiGeoJson(points);
    const source = map.getSource("radii") as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    } else if (map.isStyleLoaded() && !map.getSource("radii")) {
      map.addSource("radii", { type: "geojson", data });
      if (!map.getLayer("radii-fill")) {
        map.addLayer({
          id: "radii-fill",
          type: "fill",
          source: "radii",
          paint: {
            "fill-color": ["get", "color"],
            "fill-opacity": 0.14,
          },
        });
      }
      if (!map.getLayer("radii-line")) {
        map.addLayer({
          id: "radii-line",
          type: "line",
          source: "radii",
          paint: {
            "line-color": ["get", "color"],
            "line-width": 1.4,
            "line-opacity": 0.55,
          },
        });
      }
    }

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = points.map((point) => {
      const marker = new Marker({ element: markerEl(point) }).setLngLat([point.lng, point.lat]).addTo(map);
      marker.getElement().addEventListener("click", (event) => {
        event.stopPropagation();
        setSelected(point);
      });
      return marker;
    });

    const key = `${layer}|${status}|${points.length}`;
    if (points.length > 0 && fittedKeyRef.current !== key) {
      fittedKeyRef.current = key;
      const lngs = points.map((p) => p.lng);
      const lats = points.map((p) => p.lat);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      if (minLng === maxLng && minLat === maxLat) {
        map.easeTo({ center: [minLng, minLat], zoom: 14, duration: 400 });
      } else {
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 72, maxZoom: 15, duration: 500 },
        );
      }
    }
  }, [layer, status]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: containerRef.current,
      style: OSM_STYLE as never,
      center: BENGALURU,
      zoom: 12,
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), "top-right");
    mapRef.current = map;

    const onReady = () => {
      readyRef.current = true;
      setMapReady((tick) => tick + 1);
    };
    map.on("load", onReady);

    void fetch(OPENFREEMAP)
      .then((res) => {
        if (!res.ok) throw new Error("style");
        return res.json();
      })
      .then((style: unknown) => {
        if (mapRef.current === map) map.setStyle(style as never);
      })
      .catch(() => {
        /* OSM raster already showing */
      });

    return () => {
      map.off("load", onReady);
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    syncOverlays(visible);
  }, [mapReady, visible, syncOverlays]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const next = await getLiveMapSnapshot();
      setSnapshot(next);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useSyncSince(() => {
    void refresh();
  }, provider === "aws");

  const empty = visible.length === 0;
  const noGeotags = snapshot.points.length === 0;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <PageHeader
        title="Live Map"
        description={
          provider === "aws" || provider === "firebase"
            ? "Pickup geotags, partner vehicle GPS, household radii, and bin fill — live from AWS DynamoDB."
            : "Demo city map. Set WASTY_DATA_PROVIDER=aws and deploy the backend for live data."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={layer} onValueChange={(value) => setLayer(value as MapLayerId)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Layer" />
              </SelectTrigger>
              <SelectContent>
                {MAP_LAYERS.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setStatus(value as MapStatusFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="full">Full / critical bins</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="outline" size="icon" aria-label="Refresh" disabled={refreshing} onClick={() => void refresh()}>
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        }
      />

      <StatCards
        items={[
          { title: "Pickup points", value: String(snapshot.counts.pickups), hint: "Jobs with geotags", icon: MapPinned },
          {
            title: "Vehicles live",
            value: String(snapshot.counts.activeVehicles),
            hint: `${snapshot.counts.vehicles} total GPS pins`,
            icon: Truck,
          },
          { title: "Users", value: String(snapshot.counts.users), hint: "Household geotags + 300m radius", icon: Users },
          {
            title: "Full bins",
            value: String(snapshot.counts.fullBins),
            hint: `${snapshot.counts.bins} dustbins on map`,
            icon: Warehouse,
          },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <Card className="overflow-hidden">
          <CardContent className="relative p-0">
            <div ref={containerRef} className="h-[640px] w-full" />
            {empty ? (
              <div className="bg-background/80 absolute inset-x-4 top-4 z-10 rounded-lg border p-4 shadow-sm backdrop-blur">
                <p className="font-medium">
                  {noGeotags
                    ? provider === "firebase"
                      ? "No geotags yet"
                      : "No demo pins in this filter"
                    : "No pins match these filters"}
                </p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {noGeotags && provider === "firebase"
                    ? "Jobs, partners, and bins need lat/lng or a geo field from the user and partner apps. The street map still loads; pins appear when GPS is written."
                    : "Change the layer or status dropdown to show other pins."}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Legend</CardTitle>
              <CardDescription>Shapes are types; colors are status. Radii are real meters.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>▼ Pickup · <span className="text-sky-400">scheduled</span> / amber en route / green done</p>
              <p>■ Vehicle · blue online · grey stale (&gt;10 min)</p>
              <p>◆ User · 300m geotag circle</p>
              <p>■ Dustbin · green OK · amber 60–84% · red full</p>
              <p>▲ SOS / alerts</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{selected ? selected.title : "Select a pin"}</CardTitle>
              <CardDescription>
                {selected ? selected.subtitle : `${visible.length} pins in this filter`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {selected ? (
                <>
                  <div>Type: {selected.kind}</div>
                  <div>Status: {selected.status.replaceAll("_", " ")}</div>
                  <div className="tabular-nums">
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </div>
                  {selected.radiusM ? <div>Radius: {selected.radiusM} m</div> : null}
                  <div className="text-muted-foreground text-xs">{selected.updatedAt ?? "—"}</div>
                  {selected.href ? (
                    <Button asChild variant="link" className="h-auto px-0">
                      <Link href={selected.href}>Open record</Link>
                    </Button>
                  ) : null}
                </>
              ) : (
                <p className="text-muted-foreground">Click a pin to inspect geotag details.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
