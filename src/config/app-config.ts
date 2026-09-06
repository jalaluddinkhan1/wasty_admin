import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Wasty Admin",
  version: packageJson.version,
  copyright: `© ${currentYear}, Wasty.`,
  meta: {
    title: "Wasty Admin — Waste Management Control Center",
    description:
      "Wasty Admin is the operations console for the Wasty platform. Track users, partners, pickups, routes, bags, payouts, and support across the consumer and partner apps.",
  },
  publicSite: {
    name: "Wasty",
    domain: "wastey.in",
    title: "Wasty — Smart waste management for cities",
    description:
      "Wasty helps cities, communities, and operators collect, sort, and recover waste with live tracking, MRF intelligence, and measurable impact.",
    loginUrl: "/auth/v2/login",
  },
};
