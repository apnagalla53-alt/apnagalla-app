# EVOLIX Retail V1 Architecture

## Overview
EVOLIX is a multi-tenant ERP system. Phase 1 focuses heavily on the "Retail V1" offering, which provides a fast, mobile-first interface for retail shops (POS, Khata, basic inventory, basic accounting) while preserving the powerful shared ERP core for future modules.

## Architecture Principles
1. **Retail-First Strategy**: The active user experience is heavily optimized for retail shopkeepers (fast billing, udhar khata management, simple item creation).
2. **Mobile-First UI**: The Retail V1 interface is designed primarily for mobile usage, contrasting with the dense data-grid layouts of traditional ERP screens.
3. **Shared ERP Core**: Retail V1 is built on top of a highly robust accounting and inventory engine. Every POS sale generates double-entry accounting vouchers and strict inventory movements.
4. **Multi-Tenancy**: The platform enforces multi-tenancy at the database and application levels, isolating data by `organization_id`, `company_id`, and `branch_id`.

## Tech Stack
- **Backend**: NestJS, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Frontend**: React (Vite), Zustand, React Router

## Active Modules (Retail V1)
- **Auth / Platform**: Tenant provisioning, user roles, security guards.
- **Retail**: The facade simplifying ERP actions for retail workflows.
- **POS**: Point of Sale engine.
- **Inventory**: Stock movements, opening stock, adjustments.
- **Accounting**: Strict double-entry ledger posting, bill allocations.
- **Pricing**: Dynamic item pricing lookup.

## Frozen Modules (Future)
The following modules exist in the codebase but are **frozen** for future enterprise/distributor usage:
- **Wholesale**: Sales Orders, Purchase Orders, Quotations, Challans.
- **Intelligence**: AI capabilities, cloud sync.
- **Claims**: Warranty management.
- **Advanced Barcode**: High-volume label generation.

All these frozen frontend modules are stored in `frontend/src/future/` to keep the active workspace clean and focused on Retail V1.

## ROUTE MAP

### Backend
/api/v1/retail/items
/api/v1/retail/customers
/api/v1/retail/suppliers
/api/v1/retail/purchases
/api/v1/retail/needs
/api/v1/retail/home
/api/v1/erp/pos

### Frontend
/retail/home
/retail/bill
/retail/items
/retail/khata
/retail/suppliers
/retail/purchases
/retail/needs
/retail/more
