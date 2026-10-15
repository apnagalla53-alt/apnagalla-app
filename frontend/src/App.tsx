const RetailIntake = lazy(() => import('./retail/intake/RetailIntake'));
import { lazy, Suspense } from 'react';
import RetailErrorBoundary from './retail/RetailErrorBoundary';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './shared/store/authStore';
import BrowserSessionBootstrap, { ContinueWebsiteSession } from './shared/components/BrowserSessionBootstrap';

// Auth
const Login = lazy(() => import('./pages/Login'));
const AccountAccess = lazy(() => import('./pages/AccountAccess'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const PublicPage = lazy(() => import('./pages/PublicPages'));
import { ForgotPassword, ResetPassword, VerifyEmail } from './pages/PasswordRecovery';
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const Security = lazy(() => import('./pages/Security'));
const PlatformPublishing = lazy(() => import('./admin/platform/PlatformPublishing'));
const RetailAccount = lazy(() => import('./retail/settings/RetailAccount'));
const RetailImport = lazy(() => import('./retail/imports/RetailImport'));
const RetailCalendar = lazy(() => import('./retail/RetailCalendar'));
const RetailAssistant = lazy(() => import('./retail/assistant/RetailAssistant'));
const PlatformAssistant = lazy(() => import('./admin/platform/PlatformAssistant'));
const RetailVoiceSettings = lazy(() => import('./retail/settings/RetailVoiceSettings'));
const RetailGst = lazy(() => import('./retail/gst/RetailGst'));
const RetailGstBill = lazy(() => import('./retail/gst/RetailGstBill'));
const RetailSettings = lazy(() => import('./retail/settings/RetailSettings'));
const RetailHelp = lazy(() => import('./retail/settings/RetailHelp'));
const RetailDevices = lazy(() => import('./retail/settings/RetailDevices'));
const RetailStockLocations = lazy(() => import('./retail/settings/RetailStockLocations'));
const RetailStaff = lazy(() => import('./retail/settings/RetailStaff'));
const RetailDocuments = lazy(() => import('./retail/settings/RetailDocuments'));

// Shells
const TenantShell = lazy(() => import('./shared/components/TenantShell'));
const PlatformShell = lazy(() => import('./shared/components/PlatformShell'));

// Tenant Pages
const Users = lazy(() => import('./admin/tenant/Users'));
const Roles = lazy(() => import('./admin/tenant/Roles'));
const Sessions = lazy(() => import('./admin/tenant/Sessions'));
const Organizations = lazy(() => import('./admin/tenant/Organizations'));
const Companies = lazy(() => import('./admin/tenant/Companies'));
const Branches = lazy(() => import('./admin/tenant/Branches'));
const Godowns = lazy(() => import('./admin/tenant/Godowns'));
const FinancialYears = lazy(() => import('./admin/tenant/FinancialYears'));

// Accounting Module
const ChartOfAccounts = lazy(() => import('./pages/Accounting/ChartOfAccounts'));
const Ledger = lazy(() => import('./pages/Accounting/Ledger'));
const BankAccounts = lazy(() => import('./pages/Accounting/BankAccounts'));

// Inventory Module
const StockSummary = lazy(() => import('./pages/Inventory/StockSummary'));
const StockMovements = lazy(() => import('./pages/Inventory/StockMovements'));
const StockAdjustments = lazy(() => import('./pages/Inventory/StockAdjustments'));
const StockTransfers = lazy(() => import('./pages/Inventory/StockTransfers'));
const BarcodeLabels = lazy(() => import('./pages/Inventory/BarcodeLabels'));

// Platform Pages
const PlatformDashboard = lazy(() => import('./admin/platform/PlatformDashboard'));
const PlatformAccountPolicy = lazy(() => import('./admin/platform/PlatformAccountPolicy'));
const PlatformReferrals = lazy(() => import('./admin/platform/PlatformReferrals'));
const PlatformActivationCampaigns = lazy(() => import('./admin/platform/PlatformActivationCampaigns'));
const PlatformDeletionJobs = lazy(() => import('./admin/platform/PlatformDeletionJobs'));
const RetailReferrals = lazy(() => import('./retail/settings/RetailReferrals'));
const PlatformTenants = lazy(() => import('./admin/platform/PlatformTenants'));
const PlatformTenantDetail = lazy(() => import('./admin/platform/PlatformTenantDetail'));
const PlatformPlans = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformPlans })));
const PlatformFeatures = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformFeatures })));
const PlatformPayments = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformPayments })));
const PlatformExpenses = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformExpenses })));
const PlatformAudit = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformAudit })));
const PlatformInfrastructure = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformInfrastructure })));
const PlatformBackups = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformBackups })));
const PlatformUsers = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformUsers })));
const PlatformSessions = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformSessions })));
const PlatformSettings = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformSettings })));
const PlatformSupport = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformSupport })));
const PlatformAlerts = lazy(() => import('./admin/platform/PlatformResources').then(module => ({ default: module.PlatformAlerts })));

// ── Retail V1 Pages ──────────────────────────────
const RetailShell = lazy(() => import('./retail/RetailShell'));
const RetailGalla = lazy(() => import('./retail/counter/RetailGalla'));
const RetailUpiSettings = lazy(() => import('./retail/payments/RetailUpiSettings'));
const RetailHome = lazy(() => import('./retail/RetailHome'));
const RetailNewBill = lazy(() => import('./retail/billing/RetailNewBill'));
const RetailBillHistory = lazy(() => import('./retail/billing/RetailBillHistory'));
const RetailBillDetail = lazy(() => import('./retail/billing/RetailBillDetail'));
const RetailReturn = lazy(() => import('./retail/billing/RetailReturn'));
const RetailThermalReceipt = lazy(() => import('./retail/billing/RetailThermalReceipt'));
const RetailHeldBills = lazy(() => import('./retail/billing/RetailHeldBills'));
const RetailPayment = lazy(() => import('./retail/billing/RetailPayment'));
const RetailSaleComplete = lazy(() => import('./retail/billing/RetailSaleComplete'));
const RetailItems = lazy(() => import('./retail/RetailItems'));
const BulkItemEditor = lazy(() => import('./retail/experience/BulkItemEditor'));
const RetailAddItem = lazy(() => import('./retail/RetailAddItem'));
const RetailItemDetail = lazy(() => import('./retail/RetailItemDetail'));
const RetailAddCustomer = lazy(() => import('./retail/RetailAddCustomer'));
const RetailAmountSale = lazy(() => import('./retail/RetailAmountSale'));
const RetailKhata = lazy(() => import('./retail/RetailKhata'));
const RetailKhataDetail = lazy(() => import('./retail/RetailKhataDetail'));
const RetailReceivePayment = lazy(() => import('./retail/RetailReceivePayment'));
const RetailMore = lazy(() => import('./retail/RetailMore'));
const RetailNeeds = lazy(() => import('./retail/RetailNeeds'));
const RetailSuppliers = lazy(() => import('./retail/RetailSuppliers'));
const RetailSupplierKhata = lazy(() => import('./retail/RetailSupplierKhata'));
const RetailPaySupplier = lazy(() => import('./retail/RetailPaySupplier'));
const RetailPurchases = lazy(() => import('./retail/RetailPurchases'));
const RetailAddPurchase = lazy(() => import('./retail/RetailAddPurchase'));
const RetailExpenses = lazy(() => import('./retail/RetailExpenses'));
const RetailAddExpense = lazy(() => import('./retail/RetailAddExpense'));

// Phase 5 Reports
const RetailReports = lazy(() => import('./retail/reports/RetailReports'));
const RetailFinancialReport = lazy(() => import('./retail/reports/RetailFinancialReport'));
const RetailSalesReport = lazy(() => import('./retail/reports/RetailSalesReport'));
const RetailPurchaseReport = lazy(() => import('./retail/reports/RetailPurchaseReport'));
const RetailExpenseReport = lazy(() => import('./retail/reports/RetailExpenseReport'));
const RetailStockReport = lazy(() => import('./retail/reports/RetailStockReport'));
const RetailCustomerDueReport = lazy(() => import('./retail/reports/RetailCustomerDueReport'));
const RetailSupplierDueReport = lazy(() => import('./retail/reports/RetailSupplierDueReport'));
const RetailReturnsReport = lazy(() => import('./retail/reports/RetailReturnsReport'));

/**
 * Route guard: requires authentication.
 */
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const sessionId = useAuthStore((state) => state.session_id);
  if (!sessionId) return <Navigate to={window.location.pathname.startsWith('/platform') ? '/platform/login' : '/login'} replace />;
  return <>{children}</>;
};

/**
 * Route guard: requires platform admin role.
 */
const PlatformGuard = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (!user?.is_platform) return <Navigate to="/retail" replace />;
  return <>{children}</>;
};

/**
 * Route guard: requires tenant (non-platform) user.
 */
const TenantGuard = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  if (user?.is_platform) return <Navigate to="/platform/dashboard" replace />;
  if (user?.onboarding_state && user.onboarding_state !== 'READY') return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
};

/**
 * Route guard: requires tenant admin role or appropriate permissions.
 */
const MasterAdminGuard = ({ children }: { children: React.ReactNode }) => {
  const user = useAuthStore((state) => state.user);
  const role = (user as any)?.role;
  if (!['ADMIN','OWNER','TENANT_ADMIN'].includes(role) && !user?.permissions?.includes('identity.admin') && !user?.is_platform) {
    return <Navigate to="/retail/home" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <Router>
      <BrowserSessionBootstrap>
      <RetailErrorBoundary><Suspense fallback={<main className="r-section" role="status">Loading Apna Galla…</main>}>
      <Routes>
        {/* ── Public ──────────────────────────────────── */}
        <Route path="/login" element={<AccountAccess />} />
        <Route path="/signup" element={<AccountAccess signup />} />
        <Route path="/password-login" element={<Login />} />
        <Route path="/auth/continue" element={<ContinueWebsiteSession />} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/platform/login" element={<Login platform />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        {(['privacy','terms','support','delete-account','about'] as const).map(page=><Route key={page} path={'/'+page} element={<PublicPage page={page}/>} />)}

        {/* ── Platform Admin Routes ──────────────────── */}
        <Route
          path="/platform"
          element={
            <ProtectedRoute>
              <PlatformGuard>
                <PlatformShell />
              </PlatformGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/platform/dashboard" replace />} />
          <Route path="dashboard" element={<PlatformDashboard />} />
          <Route path="tenants" element={<PlatformTenants />} />
          <Route path="tenants/:id" element={<PlatformTenantDetail />} />
          <Route path="plans" element={<PlatformPlans />} />
          <Route path="features" element={<PlatformFeatures />} />
          <Route path="payments" element={<PlatformPayments />} />
          <Route path="subscriptions" element={<PlatformPayments />} />
          <Route path="account-policy" element={<PlatformAccountPolicy />} />
          <Route path="referrals" element={<PlatformReferrals />} />
          <Route path="activation-campaigns" element={<PlatformActivationCampaigns />} />
          <Route path="deletion-jobs" element={<PlatformDeletionJobs />} />
          <Route path="revenue" element={<PlatformPayments />} />
          <Route path="expenses" element={<PlatformExpenses />} />
          <Route path="audit" element={<PlatformAudit />} />
          <Route path="infrastructure" element={<PlatformInfrastructure />} />
          <Route path="database" element={<PlatformInfrastructure />} />
          <Route path="health" element={<PlatformInfrastructure />} />
          <Route path="backups" element={<PlatformBackups />} />
          <Route path="users" element={<PlatformUsers />} />
          <Route path="sessions" element={<PlatformSessions />} />
          <Route path="devices" element={<PlatformSessions />} />
          <Route path="settings" element={<PlatformSettings />} />
          <Route path="publishing" element={<PlatformPublishing />} />
          <Route path="support" element={<PlatformSupport />} />
          <Route path="alerts" element={<PlatformAlerts />} />
          <Route path="assistant" element={<PlatformAssistant />} />
        </Route>

        {/* ── Retail V1 Routes (Mobile First) ────────── */}
        <Route
          path="/retail"
          element={
            <ProtectedRoute>
              <TenantGuard>
                <RetailShell />
              </TenantGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/retail/home" replace />} />
          <Route path="home" element={<RetailHome />} />
          <Route path="calendar" element={<RetailCalendar />} />
          <Route path="gst" element={<RetailGst />} />
          <Route path="gst/bills/:id" element={<RetailGstBill />} />
          <Route path="assistant" element={<RetailAssistant />} />
          <Route path="stock" element={<RetailItems stockPage />} />
          <Route path="more/voice" element={<RetailVoiceSettings />} />
          <Route path="more/import" element={<RetailImport />} />
          <Route path="more/referrals" element={<RetailReferrals />} />
          <Route path="galla" element={<RetailGalla />} />
          <Route path="more/payments" element={<RetailUpiSettings />} />
          <Route path="more/security" element={<Security />} />
          <Route path="more/settings" element={<RetailSettings />} />
          <Route path="more/invoice" element={<RetailSettings invoice />} />
          {(['business','profile','subscription','features','backup'] as const).map(section=><Route key={section} path={'more/'+section} element={<RetailAccount section={section}/>} />)}
          <Route path="more/devices" element={<RetailDevices />} />
          <Route path="more/locations" element={<RetailStockLocations />} />
          <Route path="more/staff" element={<RetailStaff />} />
          <Route path="more/documents" element={<RetailDocuments />} />
          <Route path="more/help" element={<RetailHelp />} />
          <Route path="more/cash-bank" element={<Navigate to="/retail/galla" replace />} />
          <Route path="bill" element={<RetailNewBill />} />
          <Route path="bills" element={<RetailBillHistory />} />
          <Route path="bills/:id" element={<RetailBillDetail />} />
          <Route path="bills/:id/print" element={<RetailThermalReceipt />} />
          <Route path="bills/:id/return" element={<RetailReturn />} />
          <Route path="bills/held" element={<RetailHeldBills />} />
          <Route path="payment" element={<RetailPayment />} />
          <Route path="sale-complete" element={<RetailSaleComplete />} />
          <Route path="items" element={<RetailItems />} />
          <Route path="items/add" element={<RetailAddItem />} />
          <Route path="items/add-faster" element={<RetailIntake />} />
          <Route path="items/bulk" element={<BulkItemEditor />} />
          <Route path="items/:id" element={<RetailItemDetail />} />
          <Route path="customers/add" element={<RetailAddCustomer />} />
          <Route path="khata" element={<RetailKhata />} />
          <Route path="khata/:id" element={<RetailKhataDetail />} />
          <Route path="receive-payment" element={<RetailReceivePayment />} />
          <Route path="pay-supplier" element={<RetailPaySupplier />} />
          <Route path="quick-sale" element={<RetailNewBill quick />} />
          <Route path="amount-sale" element={<RetailAmountSale />} />
          <Route path="udhar" element={<RetailAmountSale udhar />} />
          <Route path="more" element={<RetailMore />} />

          {/* Phase 2 Routes */}
          <Route path="needs" element={<RetailNeeds />} />
          <Route path="suppliers" element={<RetailSuppliers />} />
          <Route path="suppliers/:id" element={<RetailSupplierKhata />} />
          <Route path="suppliers/:id/pay" element={<RetailPaySupplier />} />
          <Route path="purchases" element={<RetailPurchases />} />
          <Route path="purchases/new" element={<RetailAddPurchase />} />

          {/* Phase 3 Routes */}
          <Route path="expenses" element={<RetailExpenses />} />
          <Route path="expenses/add" element={<RetailAddExpense />} />

          {/* Phase 5 Routes */}
          <Route path="reports" element={<RetailReports />} />
          <Route path="reports/sales" element={<RetailSalesReport />} />
          <Route path="reports/financial/:kind" element={<RetailFinancialReport />} />
          <Route path="reports/purchases" element={<RetailPurchaseReport />} />
          <Route path="reports/expenses" element={<RetailExpenseReport />} />
          <Route path="reports/stock" element={<RetailStockReport />} />
          <Route path="reports/customers" element={<RetailCustomerDueReport />} />
          <Route path="reports/suppliers" element={<RetailSupplierDueReport />} />
          <Route path="reports/returns" element={<RetailReturnsReport />} />

          {/* Fallbacks for missing feature pages */}
          <Route path="more/*" element={
            <div style={{ padding: '2rem', textAlign: 'center' }}>
              <h2>Page not found</h2>
              <p>Open More to choose a shop setting.</p><a href="/retail/more">Back to More</a>
            </div>
          } />
          <Route path="*" element={<div className="r-empty"><h1>Page not found</h1><a href="/retail/home">Return Home</a></div>} />
        </Route>

        {/* ── Tenant Admin/Master Setup Routes ────────── */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TenantGuard>
                <MasterAdminGuard>
                  <TenantShell />
                </MasterAdminGuard>
              </TenantGuard>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/retail/home" replace />} />

          {/* Masters */}
          <Route path="users" element={<Users />} />
          <Route path="roles" element={<Roles />} />
          <Route path="sessions" element={<Sessions />} />
          <Route path="organizations" element={<Organizations />} />
          <Route path="companies" element={<Companies />} />
          <Route path="branches" element={<Branches />} />
          <Route path="godowns" element={<Godowns />} />
          <Route path="financial-years" element={<FinancialYears />} />

          {/* Inventory Module Config */}
          <Route path="inventory/stock" element={<StockSummary />} />
          <Route path="inventory/movements" element={<StockMovements />} />
          <Route path="inventory/adjustments" element={<StockAdjustments />} />
          <Route path="inventory/transfers" element={<StockTransfers />} />
          <Route path="inventory/barcodes" element={<BarcodeLabels />} />

          {/* Accounting Module Config */}
          <Route path="accounting/accounts" element={<ChartOfAccounts />} />
          <Route path="accounting/ledger/:id" element={<Ledger />} />
          <Route path="accounting/banks" element={<BankAccounts />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/retail/home" replace />} />
      </Routes>
    </Suspense></RetailErrorBoundary>
      </BrowserSessionBootstrap>
    </Router>
  );
}

export default App;
