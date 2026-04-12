import {
  LayoutGrid,
  ShoppingBag,
  MessageSquare,
  BarChart2,
  Users,
  Bell,
  User,
  Settings,
  LogOut,
  HelpCircle,
  Percent,  // For Price/Discount
} from "lucide-react";

export const menu = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid, path: "/dashboard", roles: ['Owner', 'Customer', 'Employee'] },
  { key: "products", label: "Products", icon: ShoppingBag, path: "/catalogue", roles: ['Customer', 'Employee'] },
  { key: "messages", label: "Messages", icon: MessageSquare, path:"/messages", roles: ['Owner', 'Customer', 'Employee'] },
  { key: "analytics", label: "Analytics", icon: BarChart2, roles: ['Owner'] }, // Usually maps to Reports
  { key: "customers", label: "Customers", icon: Users, path: "/users", roles: ['Owner', 'Employee'] },
  { key: "pricing", label: "Price/Discount", translationKey: "product_pricing", icon: Percent, path: "/masters" ,roles: ['Owner'] },
  { key: "notifications", label: "Notifications", icon: Bell, badge: 3, roles: ['Owner', 'Customer', 'Employee'] },
  { key: "profile", label: "Profile", icon: User, roles: ['Owner', 'Customer', 'Employee'] },
  { key: "settings", label: "Settings", translationKey: "settings_page", icon: Settings, path:"/settings" ,roles: ['Owner', 'Customer', 'Employee'] },
  { key: "logout", label: "Logout", icon: LogOut, roles: ['Owner', 'Customer', 'Employee'] }, // ← lowercase "logout"
  { key: "help", label: "Help & Support", translationKey: "help_support", icon: HelpCircle, roles: ['Owner', 'Customer', 'Employee'] },
];