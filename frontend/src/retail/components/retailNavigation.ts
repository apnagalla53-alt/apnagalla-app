import {
  House, ReceiptText, FileBadge, Package, BookOpen, Zap, Wallet, History,
  Bookmark, Tags, Boxes, TriangleAlert, ShoppingCart, ClipboardList, Warehouse,
  UsersRound, Truck, BanknoteArrowDown, BanknoteArrowUp, ReceiptIndianRupee,
  Calculator, ChartNoAxesCombined, CalendarDays, MessageCircle, Store,
  CircleUserRound, BadgeCheck, SlidersHorizontal, UserRoundCog, Files,
  Smartphone, QrCode, Printer, Settings, Languages, Volume2, Shield,
  FileInput, DatabaseBackup, Headset, ShieldCheck, FileText, Info, Grid2X2,
  Receipt, PackageSearch, CircleDollarSign, ChartLine, Building2, Settings2,
  type LucideIcon,
} from 'lucide-react';
import type { User } from '../../shared/store/authStore';

export interface DrawerNavItem {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  permissions?: readonly string[];
  features?: readonly string[];
  anyFeature?: readonly string[];
  ownerOnly?: boolean;
  activePattern?: RegExp;
  elementId?: string;
}
export interface DrawerNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  children: readonly DrawerNavItem[];
}
export interface DrawerAccess {
  user: User | null;
  features: ReadonlySet<string> | null;
}
const retail = ['RETAIL_POS'] as const;
const inventory = ['RETAIL_POS', 'INVENTORY'] as const;
const purchasing = ['RETAIL_POS', 'PURCHASING'] as const;
const khata = ['RETAIL_POS', 'KHATA'] as const;

// Navigation mirrors existing server guards. It never grants access: the API
// continues to enforce the authenticated membership and effective entitlements.
export const drawerQuickLinks: readonly DrawerNavItem[] = [
  { id: 'home', label: 'Home', route: '/retail/home', icon: House },
  { id: 'quick-sale', label: 'Quick Bill', route: '/retail/quick-sale', icon: Zap, permissions: ['sales.write'], features: retail },
  { id: 'bill', label: 'Detailed Bill', route: '/retail/bill', icon: ReceiptText, permissions: ['sales.write'], features: inventory },
  { id: 'gst', label: 'GST Invoices', route: '/retail/gst', icon: FileBadge, permissions: ['sales.read'], features: ['RETAIL_POS','GST_INVOICES'] },
  { id: 'inventory', label: 'Inventory', route: '/retail/stock', icon: Package, permissions: ['inventory.read'], features: inventory },
  { id: 'khata', label: 'Khata', route: '/retail/khata', icon: BookOpen, permissions: ['accounting.read'], features: khata },
  { id: 'suppliers', label: 'Suppliers', route: '/retail/suppliers', icon: Truck, permissions: ['purchase.read'], features: purchasing },
];

export const drawerGroups: readonly DrawerNavGroup[] = [
  { id: 'sell', label: 'Sell & Billing', icon: Receipt, children: [
    { id: 'quick-sale', label: 'Quick Bill', route: '/retail/quick-sale', icon: Zap, permissions: ['sales.write'], features: retail },
    { id: 'udhar', label: 'Udhar Sale', route: '/retail/udhar', icon: Wallet, permissions: ['sales.write', 'accounting.read'], features: khata, elementId: 'qa-udhar' },
    { id: 'bills', label: 'Bill History', route: '/retail/bills', icon: History, permissions: ['sales.read'], features: retail },
    { id: 'held', label: 'Held Bills', route: '/retail/bills/held', icon: Bookmark, permissions: ['sales.read'], features: retail, elementId: 'qa-held-bills' },
  ] },
  { id: 'inventory', label: 'Inventory & Stock', icon: PackageSearch, children: [
    { id: 'items', label: 'Items', route: '/retail/items', icon: Tags, permissions: ['inventory.read'], features: inventory },
    { id: 'stock', label: 'Stock', route: '/retail/stock', icon: Boxes, permissions: ['inventory.read'], features: inventory },
    { id: 'low-stock', label: 'Low Stock', route: '/retail/stock?view=low', icon: TriangleAlert, permissions: ['inventory.read'], features: inventory },
    { id: 'purchases', label: 'Purchases', route: '/retail/purchases', icon: ShoppingCart, permissions: ['purchase.read'], features: purchasing },
    { id: 'needs', label: 'Need List', route: '/retail/needs', icon: ClipboardList, permissions: ['inventory.read'], features: inventory, elementId: 'qa-need-list' },
    { id: 'locations', label: 'Stock Locations', route: '/retail/more/locations', icon: Warehouse, permissions: ['identity.admin'], anyFeature: ['MULTIPLE_STOCK_LOCATIONS', 'MULTI_LOCATION'] },
  ] },
  { id: 'people', label: 'People & Money', icon: CircleDollarSign, children: [
    { id: 'customers', label: 'Customers / Khata', route: '/retail/khata', icon: UsersRound, permissions: ['accounting.read'], features: khata },
    { id: 'suppliers', label: 'Suppliers', route: '/retail/suppliers', icon: Truck, permissions: ['purchase.read'], features: purchasing },
    { id: 'receive', label: 'Receive Customer Payment', route: '/retail/receive-payment', icon: BanknoteArrowDown, permissions: ['accounting.read', 'accounting.write'], features: khata },
    { id: 'pay-supplier', label: 'Supplier Payment', route: '/retail/pay-supplier', icon: BanknoteArrowUp, permissions: ['purchase.read', 'purchase.write'], features: purchasing, activePattern: /^\/retail\/suppliers\/[^/]+\/pay$/ },
    { id: 'expenses', label: 'Expenses', route: '/retail/expenses', icon: ReceiptIndianRupee, permissions: ['accounting.read'], features: ['EXPENSES'] },
    { id: 'galla', label: 'Daily Galla', route: '/retail/galla', icon: Calculator, permissions: ['accounting.read'], features: ['RETAIL_POS', 'ACCOUNTING'] },
  ] },
  { id: 'reports', label: 'Reports & Insights', icon: ChartLine, children: [
    { id: 'reports', label: 'Reports', route: '/retail/reports', icon: ChartNoAxesCombined, permissions: ['reports.read'], features: ['RETAIL_POS', 'REPORTS'] },
    { id: 'calendar', label: 'Calendar', route: '/retail/calendar', icon: CalendarDays, permissions: ['accounting.read'], features: retail },
    { id: 'assistant', label: 'Ask Apna Galla', route: '/retail/assistant', icon: MessageCircle, features: ['RETAIL_POS','ASSISTANT_TEXT'] },
  ] },
  { id: 'business', label: 'Business & Staff', icon: Building2, children: [
    { id: 'business', label: 'My Business', route: '/retail/more/business', icon: Store },
    { id: 'staff', label: 'Staff', route: '/retail/more/staff', icon: UserRoundCog, permissions: ['identity.admin'], features: ['STAFF'] },
    { id: 'features', label: 'Shop Features', route: '/retail/more/features', icon: SlidersHorizontal },
    { id: 'documents', label: 'Documents', route: '/retail/more/documents', icon: Files, permissions: ['documents.read'] },
    { id: 'devices', label: 'Devices', route: '/retail/more/devices', icon: Smartphone },
    { id: 'upi', label: 'UPI & Payments', route: '/retail/more/payments', icon: QrCode, permissions: ['sales.read', 'settings.write'], features: retail },
    { id: 'printer', label: 'Printer & Invoice', route: '/retail/more/invoice', icon: Printer, permissions: ['sales.read'], features: retail },
    { id: 'subscription', label: 'Subscription', route: '/retail/more/subscription', icon: BadgeCheck },
    { id: 'referrals', label: 'Refer a Friend', route: '/retail/more/referrals', icon: UsersRound, ownerOnly:true },
    { id: 'profile', label: 'Profile', route: '/retail/more/profile', icon: CircleUserRound },
  ] },
  { id: 'settings', label: 'Settings & Help', icon: Settings2, children: [
    { id: 'settings', label: 'Settings', route: '/retail/more/settings', icon: Settings },
    { id: 'language', label: 'Language', route: '/retail/more/settings#language', icon: Languages },
    { id: 'voice', label: 'Payment voice greeting', route: '/retail/more/voice', icon: Volume2, permissions: ['sales.read', 'settings.write'], features: retail },
    { id: 'security', label: 'Security', route: '/retail/more/security', icon: Shield },
    { id: 'import', label: 'Import Data', route: '/retail/more/import', icon: FileInput, ownerOnly: true, features: retail },
    { id: 'backup', label: 'Backup / Export', route: '/retail/more/backup', icon: DatabaseBackup, ownerOnly: true },
    { id: 'help', label: 'Help & Support', route: '/retail/more/help', icon: Headset },
    { id: 'privacy', label: 'Privacy', route: '/privacy', icon: ShieldCheck },
    { id: 'terms', label: 'Terms', route: '/terms', icon: FileText },
    { id: 'about', label: 'About Apna Galla', route: '/about', icon: Info },
    { id:'audit',label:'Audit History',route:'/retail/audit',icon:History,permissions:['settings.write'] },
    { id: 'all-tools', label: 'All settings & tools', route: '/retail/more', icon: Grid2X2 },
  ] },
];

export function canShowDrawerItem(item: DrawerNavItem, access: DrawerAccess): boolean {
  if (!access.user || access.user.is_platform) return false;
  const owner = ['ADMIN', 'OWNER', 'TENANT_ADMIN'].includes(access.user.role || '');
  if (item.ownerOnly && !owner) return false;
  if (!owner && item.permissions?.some(permission => !access.user?.permissions?.includes(permission))) return false;
  if (item.features?.some(feature => !access.features?.has(feature))) return false;
  if (item.anyFeature && !item.anyFeature.some(feature => access.features?.has(feature))) return false;
  return true;
}

export function visibleDrawerNavigation(access: DrawerAccess) {
  return {
    quick: drawerQuickLinks.filter(item => canShowDrawerItem(item, access)),
    groups: drawerGroups.map(group => ({ ...group, children: group.children.filter(item => canShowDrawerItem(item, access)) }))
      .filter(group => group.children.length > 0),
  };
}

// Daily navigation has one destination per task. The larger registry above is
// retained for permission-filtered settings pages and saved quick shortcuts.
const findTool = (id: string) => [...drawerQuickLinks, ...drawerGroups.flatMap(group => group.children)].find(item => item.id === id)!;
export const simpleDrawerItems: readonly DrawerNavItem[] = [
  findTool('home'), findTool('quick-sale'), findTool('galla'),
  { ...findTool('bills'), label: 'Bills / Sales' },
  { ...findTool('purchases'), label: 'Purchases / Buy Stock' },
  { ...findTool('items'), id: 'inventory', label: 'Inventory' },
  findTool('khata'), findTool('suppliers'), findTool('expenses'), findTool('reports'), findTool('staff'),
  findTool('business'),
  { id: 'settings-help', label: 'Settings & Help', route: '/retail/more', icon: Settings2 },
];
export const visibleSimpleDrawer = (access: DrawerAccess) => simpleDrawerItems.filter(item => canShowDrawerItem(item, access));

export interface DrawerLocation { pathname: string; search: string; hash: string }
function matchScore(item: DrawerNavItem, location: DrawerLocation): number {
  if (item.activePattern?.test(location.pathname)) return 1000;
  const route = new URL(item.route, 'https://navigation.invalid');
  if (location.pathname !== route.pathname && !location.pathname.startsWith(route.pathname + '/')) return -1;
  if (route.pathname === '/retail/more' && location.pathname !== route.pathname) return -1;
  const search = new URLSearchParams(location.search);
  if ([...route.searchParams].some(([key, value]) => search.get(key) !== value)) return -1;
  if (route.hash && route.hash !== location.hash) return -1;
  return route.pathname.length + (route.search ? 100 : 0) + (route.hash ? 100 : 0);
}

export function activeDrawerItem(items: readonly DrawerNavItem[], location: DrawerLocation): string | null {
  let active: string | null = null, best = -1;
  for (const item of items) {
    const score = matchScore(item, location);
    if (score > best) { best = score; active = item.id; }
  }
  return active;
}
