import { getDataProvider } from "@/lib/firebase/config";

import { PassportClient } from "./_components/passport-client";

export default function PassportPage() {
  return <PassportClient provider={getDataProvider()} />;
}
