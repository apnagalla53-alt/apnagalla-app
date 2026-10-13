import { ui, useUiLanguage } from "../../i18n";
import { Link, useLocation } from "react-router-dom";
import {
  PlusCircle,
  Package,
  AlertTriangle,
  Receipt,
  ShoppingCart,
  Wallet,
  Users,
  BookUser,
} from "lucide-react";
type Tab = { label: string; path: string; Icon: typeof Package };
export function TabStrip({ label, tabs }: { label: string; tabs: Tab[] }) {
  useUiLanguage();
  const { pathname, search } = useLocation();
  return (
    <nav className="r-workflow-tabs" aria-label={ui(label)}>
      {tabs.map(({ label, path, Icon }) => {
        const [route, query = ""] = path.split("?");
        const active =
          pathname === route && search === (query ? "?" + query : "");
        return (
          <Link
            key={path}
            to={path}
            aria-current={active ? "page" : undefined}
            className={active ? "is-active" : ""}
          >
            <Icon size={21} />
            <span>{ui(label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
export default function RetailWorkflowTabs() {
  useUiLanguage();
  const { pathname } = useLocation();
  if (
    ["/retail/items", "/retail/stock", "/retail/items/add"].includes(pathname)
  )
    return (
      <TabStrip
        label="Inventory workflows"
        tabs={[
          { label: "Add Item", path: "/retail/items/add", Icon: PlusCircle },
          {
            label: "Inventory",
            path:
              pathname === "/retail/items" ? "/retail/items" : "/retail/stock",
            Icon: Package,
          },
          {
            label: "Low Stock",
            path: "/retail/stock?view=low",
            Icon: AlertTriangle,
          },
        ]}
      />
    );
  if (
    [
      "/retail/bill",
      "/retail/quick-sale",
      "/retail/udhar",
      "/retail/bills",
    ].includes(pathname)
  )
    return (
      <TabStrip
        label="Sales workflows"
        tabs={[
          { label: "Make Bill", path: "/retail/bill", Icon: PlusCircle },
          { label: "Quick Sale", path: "/retail/quick-sale", Icon: Receipt },
          { label: "Udhar Sale", path: "/retail/udhar", Icon: Wallet },
          { label: "History", path: "/retail/bills", Icon: Receipt },
        ]}
      />
    );
  if (
    [
      "/retail/purchases",
      "/retail/purchases/new",
      "/retail/pay-supplier",
    ].includes(pathname)
  )
    return (
      <TabStrip
        label="Purchase workflows"
        tabs={[
          { label: "History", path: "/retail/purchases", Icon: Receipt },
          {
            label: "Buy Stock",
            path: "/retail/purchases/new",
            Icon: ShoppingCart,
          },
          { label: "Make Payment", path: "/retail/pay-supplier", Icon: Wallet },
        ]}
      />
    );
  if (pathname === "/retail/suppliers")
    return (
      <TabStrip
        label="Parties"
        tabs={[
          { label: "Customers", path: "/retail/khata", Icon: Users },
          { label: "Suppliers", path: "/retail/suppliers", Icon: BookUser },
        ]}
      />
    );
  if (["/retail/expenses", "/retail/expenses/add"].includes(pathname))
    return (
      <TabStrip
        label="Expense workflows"
        tabs={[
          {
            label: "Business Expense",
            path: "/retail/expenses/add",
            Icon: Wallet,
          },
          {
            label: "Owner Withdrawal",
            path: "/retail/expenses/add?type=OWNER_WITHDRAWAL",
            Icon: Users,
          },
          { label: "History", path: "/retail/expenses", Icon: Receipt },
        ]}
      />
    );
  return null;
}
