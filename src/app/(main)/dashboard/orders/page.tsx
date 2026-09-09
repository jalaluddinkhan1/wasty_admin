import { getDataProvider } from "@/lib/firebase/config";
import { listOrders } from "@/server/wasty-actions";

import { OrdersClient } from "./_components/orders-client";

export default async function OrdersPage() {
  const orders = await listOrders().catch(() => []);
  return <OrdersClient initialOrders={orders} provider={getDataProvider()} />;
}
