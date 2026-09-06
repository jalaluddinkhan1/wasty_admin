import { type AdminType, hasPermission, type Permission } from "@/lib/auth/permissions";
import type { NavGroup, NavMainItem, NavSubItem } from "@/navigation/sidebar/sidebar-items";

function canSee(adminType: AdminType, permission?: Permission, roles?: AdminType[]) {
  if (roles && !roles.includes(adminType)) return false;
  if (!permission) return adminType === "owner";
  return hasPermission(adminType, permission);
}

function filterItem(item: NavMainItem, adminType: AdminType): NavMainItem | null {
  if (item.subItems) {
    const subItems = item.subItems.filter((sub: NavSubItem) =>
      canSee(adminType, sub.permission ?? item.permission, sub.roles ?? item.roles),
    );
    if (subItems.length === 0) return null;
    return { ...item, subItems };
  }
  if (!canSee(adminType, item.permission, item.roles)) return null;
  return item;
}

export function filterSidebarItems(groups: NavGroup[], adminType: AdminType): NavGroup[] {
  return groups
    .map((group, index) => ({
      ...group,
      id: group.id || index + 1,
      items: group.items.map((item) => filterItem(item, adminType)).filter((item): item is NavMainItem => item != null),
    }))
    .filter((group) => group.items.length > 0);
}
