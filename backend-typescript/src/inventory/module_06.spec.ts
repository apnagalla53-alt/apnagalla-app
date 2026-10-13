import { Test, TestingModule } from '@nestjs/testing';
import { OpeningStockService } from './opening-stock.service';
import { StockCountService } from './stock-count.service';
import { StockAdjustmentService } from './adjustment.service';
import { StockTransferService } from './transfer.service';
import { InventoryPostingService } from './posting.service';
import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { PrismaService } from '../database/prisma.service';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('Module 06 - Integration and Security Tests', () => {
  let openingStockService: OpeningStockService;
  let stockCountService: StockCountService;
  let stockAdjustmentService: StockAdjustmentService;
  let stockTransferService: StockTransferService;
  let prisma: PrismaService;
  let inventoryPosting: InventoryPostingService;
  let accountingPosting: AccountingPostingService;

  beforeEach(async () => {
    // We mock the database to test security and validation logic
    const prismaServiceMock = {
      $queryRaw:vi.fn().mockResolvedValue([]),
      openingStock: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      stockCount: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
      godown: { findUnique: vi.fn() },
      stockAdjustment: { findUnique: vi.fn() },
      stockTransfer: { findUnique: vi.fn() },
      ledgerAccount: { findFirst: vi.fn(), create: vi.fn().mockResolvedValue({ id: 'ledger-1' }) },
      $transaction: vi.fn((cb) => cb(prisma)),
    };

    const inventoryPostingMock = {
      postMovement: vi.fn(),
      reverseMovement: vi.fn(),
    };

    const accountingPostingMock = {
      postVoucher: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpeningStockService,
        StockCountService,
        StockAdjustmentService,
        StockTransferService,
        { provide: PrismaService, useValue: prismaServiceMock },
        { provide: InventoryPostingService, useValue: inventoryPostingMock },
        { provide: AccountingPostingService, useValue: accountingPostingMock },
      ],
    }).compile();

    openingStockService = module.get<OpeningStockService>(OpeningStockService);
    stockCountService = module.get<StockCountService>(StockCountService);
    stockAdjustmentService = module.get<StockAdjustmentService>(StockAdjustmentService);
    stockTransferService = module.get<StockTransferService>(StockTransferService);
    prisma = module.get<PrismaService>(PrismaService);
    inventoryPosting = module.get<InventoryPostingService>(InventoryPostingService);
    accountingPosting = module.get<AccountingPostingService>(AccountingPostingService);
  });

  describe('Tenant/Company/Branch Isolation (Security)', () => {
    it('OpeningStockService should reject posting to a godown in a different branch', async () => {
      vi.spyOn(prisma.godown, 'findUnique').mockResolvedValue({
        id: 'godown-1',
        name: 'Warehouse A',
        company_id: 'company-1',
        branch_id: 'other-branch', // different branch
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      await expect(
        openingStockService.postOpeningStock({
          company_id: 'company-1',
          branch_id: 'branch-1', // target branch
          financial_year_id: 'fy-1',
          document_number: 'doc-1',
          document_date: new Date(),
          posted_by: 'user-1',
          lines: [{ item_id: 'item-1', godown_id: 'godown-1', unit_id: 'unit-1', quantity: 10, cost_rate: 100 }],
        })
      ).rejects.toThrow(ForbiddenException);
    });

    it('StockCountService should reject posting to a godown in a different company/branch', async () => {
      vi.spyOn(prisma.godown, 'findUnique').mockResolvedValue({
        id: 'godown-2',
        name: 'Warehouse B',
        branch_id: 'other-branch',
        created_at: new Date(),
        updated_at: new Date(),
      } as any);

      await expect(
        stockCountService.createStockCount({
          company_id: 'company-1',
          branch_id: 'branch-1',
          financial_year_id: 'fy-1',
          document_number: 'DOC-1',
          count_date: new Date(),
          godown_id: 'godown-2',
          posted_by: 'user-1',
          lines: [{ item_id: 'item-1', unit_id: 'unit-1', counted_quantity: 10, current_stock: 5 } as any],
        } as any, 'user-1')
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Accounting Integration', () => {
    it('OpeningStockService should trigger postVoucher when accounting_ledger_id is provided', async () => {
      vi.spyOn(prisma.godown, 'findUnique').mockResolvedValue({
        id: 'godown-1',
        company_id: 'company-1',
        branch_id: 'branch-1',
      } as any);

      vi.spyOn(prisma.openingStock, 'create').mockResolvedValue({
        id: 'os-1',
        voucher_id: 'voucher-1',
        lines: [{ id: 'l1', item_id: 'item-1', godown_id: 'godown-1', unit_id: 'unit-1', quantity: 10, cost_rate: 50 }],
      } as any);

      await openingStockService.postOpeningStock({
        company_id: 'company-1',
        branch_id: 'branch-1',
        financial_year_id: 'fy-1',
        document_number: 'doc-2',
        document_date: new Date(),
        posted_by: 'user-1',
        accounting_ledger_id: 'stock-ledger', // triggers accounting
        lines: [{ item_id: 'item-1', godown_id: 'godown-1', unit_id: 'unit-1', quantity: 10, cost_rate: 50 }],
      });

      expect(inventoryPosting.postMovement).toHaveBeenCalled();
      expect(accountingPosting.postVoucher).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          voucher_type: 'JOURNAL',
          lines: expect.arrayContaining([
            expect.objectContaining({ debit: new Prisma.Decimal(500), credit: 0, ledger_account_id: 'ledger-1' }),
            expect.objectContaining({ debit: 0, credit: new Prisma.Decimal(500), ledger_account_id: 'ledger-1' }),
          ]),
        })
      );
    });

    it('OpeningStockService should skip postVoucher if value is zero', async () => {
      vi.spyOn(prisma.godown, 'findUnique').mockResolvedValue({
        id: 'godown-1',
        company_id: 'company-1',
        branch_id: 'branch-1',
      } as any);

      vi.spyOn(prisma.openingStock, 'create').mockResolvedValue({ 
        id: 'os-1',
        lines: [{ id: 'l1', item_id: 'item-1', godown_id: 'godown-1', unit_id: 'unit-1', quantity: 10, cost_rate: 0 }],
      } as any);

      await openingStockService.postOpeningStock({
        company_id: 'company-1',
        branch_id: 'branch-1',
        financial_year_id: 'fy-1',
        document_number: 'doc-3',
        document_date: new Date(),
        posted_by: 'user-1',
        lines: [{ item_id: 'item-1', godown_id: 'godown-1', unit_id: 'unit-1', quantity: 10, cost_rate: 0 }],
      });

      expect(inventoryPosting.postMovement).toHaveBeenCalled();
      expect(accountingPosting.postVoucher).not.toHaveBeenCalled();
    });
  });

  describe('Reversal Functionality', () => {
    it('StockAdjustmentService should reject reverseAdjustment if already cancelled', async () => {
      vi.spyOn(prisma.stockAdjustment, 'findUnique').mockResolvedValue({
        id: 'adj-1',
        status: 'CANCELLED',
      } as any);

      await expect(stockAdjustmentService.reverseAdjustment('adj-1', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('StockTransferService should reject reverseTransfer if already cancelled', async () => {
      vi.spyOn(prisma.stockTransfer, 'findUnique').mockResolvedValue({
        id: 'tr-1',
        status: 'CANCELLED',
      } as any);

      await expect(stockTransferService.reverseTransfer('tr-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });
});
