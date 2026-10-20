/** Download the requested screen during session verification. Never mount it or
 * read shop data until BrowserSessionBootstrap and the route guards allow it. */
export function preloadInitialRoute(path: string): void {
  const downloads: Promise<unknown>[] = [];
  if (path.startsWith('/retail')) {
    downloads.push(import('../retail/RetailShell'));
    if (['/retail', '/retail/', '/retail/home'].includes(path)) downloads.push(import('../retail/RetailHome'));
    else if (['/retail/bill', '/retail/quick-sale', '/retail/service-calculator'].includes(path)) downloads.push(import('../retail/billing/RetailNewBill'));
    else if (['/retail/items', '/retail/stock'].includes(path)) downloads.push(import('../retail/RetailItems'));
    else if (path === '/retail/khata') downloads.push(import('../retail/RetailKhata'));
  } else if (['/login', '/signup'].includes(path)) downloads.push(import('../pages/AccountAccess'));
  else if (path === '/password-login') downloads.push(import('../pages/Login'));
  else if (['/forgot-password', '/reset-password', '/verify-email'].includes(path)) downloads.push(import('../pages/PasswordRecovery'));
  // A failed preload remains retryable through the normal route/error boundary.
  for (const download of downloads) void download.catch(() => {});
}
