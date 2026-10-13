import { Test, TestingModule } from '@nestjs/testing';
import { PostingService } from './posting.service';
import { PrismaService } from '../database/prisma.service';
import { PostingService as AccountingPostingService } from '../accounting/posting.service';
import { InventoryPostingService } from '../inventory/posting.service';

describe('PostingService', () => {
  let service: PostingService;
  let prisma: PrismaService;
  let inventoryService: InventoryPostingService;

  beforeEach(async () => {
    // Basic mock of PrismaService
    const mockPrisma = {
      $transaction: vi.fn(async (callback) => {
        // mock tx object which looks like prisma but with limited methods
        const tx = {
          $queryRaw:vi.fn().mockResolvedValue([]),
          goodsReceipt: {
            findUnique: vi.fn(),
            update: vi.fn(),
          },
          purchaseOrder: {
            findUnique: vi.fn(),
            update: vi.fn(),
          },
          purchaseOrderLine: {
            update: vi.fn(),
            findMany: vi.fn(),
          },
          stockMovement: {
            create: vi.fn(),
          },
          stockBalanceProjection: {
            findFirst: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
          },
          auditLog: {
            create: vi.fn(),
          },
        };
        return callback(tx);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AccountingPostingService, useValue: { postVoucher: vi.fn(), reverseVoucher: vi.fn() } },
        { provide: InventoryPostingService, useValue: { postMovement: vi.fn(), reverseMovement: vi.fn() } },
      ],
    }).compile();

    service = module.get<PostingService>(PostingService);
    prisma = module.get<PrismaService>(PrismaService);
    inventoryService = module.get<InventoryPostingService>(InventoryPostingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('postGoodsReceipt', () => {
    it('should throw if GRN is already posted (idempotency test)', async () => {
      // We need to override the $transaction mock behavior to simulate a specific test case
      (prisma.$transaction as any).mockImplementationOnce(async (callback: any) => {
        const tx = {
          $queryRaw:vi.fn().mockResolvedValue([]),
          goodsReceipt: {
            // This fixture exercises the pre-post row lock through the tx mock.
            findUnique: vi.fn().mockResolvedValue({ status: 'POSTED', lines: [] })
          }
        };
        return callback(tx);
      });

      await expect(service.postGoodsReceipt('grn-1', 'user-1')).rejects.toThrow('GRN is already posted');
    });

    it('should throw if received quantity is <= 0', async () => {
      (prisma.$transaction as any).mockImplementationOnce(async (callback: any) => {
        const tx = {
          $queryRaw:vi.fn().mockResolvedValue([]),
          goodsReceipt: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'grn-1',
              status: 'DRAFT',
              lines: [{ id: 'line-1', received_quantity: 0 }]
            })
          }
        };
        return callback(tx);
      });

      await expect(service.postGoodsReceipt('grn-1', 'user-1')).rejects.toThrow('Invalid quantity on line line-1. Must be > 0.');
    });

    it('should throw if over-receipt occurs', async () => {
       (prisma.$transaction as any).mockImplementationOnce(async (callback: any) => {
        const tx = {
          $queryRaw:vi.fn().mockResolvedValue([]),
          goodsReceipt: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'grn-1',
              status: 'DRAFT',
              purchase_order_id: 'po-1',
              lines: [{ id: 'line-1', received_quantity: 50, purchase_order_line_id: 'po-line-1' }]
            })
          },
          purchaseOrder: {
             findUnique: vi.fn().mockResolvedValue({
               id: 'po-1',
               status: 'CONFIRMED',
               lines: [{ id: 'po-line-1', ordered_quantity: 40, received_quantity: 0 }] // ordered 40, receiving 50
             })
          }
        };
        return callback(tx);
      });

      await expect(service.postGoodsReceipt('grn-1', 'user-1')).rejects.toThrow('Over-receipt prevented');
    });

    it('should successfully post GRN, create StockMovement and update PO', async () => {
       let poStatusUpdated = false;

       (prisma.$transaction as any).mockImplementationOnce(async (callback: any) => {
        const tx = {
          $queryRaw:vi.fn().mockResolvedValue([]),
          item:{findFirst:vi.fn().mockResolvedValue({id:'item1',track_serial:false})},
          stockMovement:{findMany:vi.fn().mockResolvedValue([])},
          goodsReceipt: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'grn-1',
              status: 'DRAFT',
              purchase_order_id: 'po-1',
              lines: [{ id: 'line-1', received_quantity: 40, purchase_order_line_id: 'po-line-1', item_id: 'item1', godown_id: 'g1', company_id: 'c1', branch_id: 'b1' }]
            }),
            update: vi.fn().mockResolvedValue(true)
          },
          purchaseOrder: {
             findUnique: vi.fn().mockResolvedValue({
               id: 'po-1',
               status: 'CONFIRMED',
               lines: [{ id: 'po-line-1', ordered_quantity: 40, received_quantity: 0 }] 
             }),
             update: vi.fn().mockImplementation(() => { poStatusUpdated = true; return true; })
          },
          purchaseOrderLine: {
             update: vi.fn(),
             findMany: vi.fn().mockResolvedValue([{ id: 'po-line-1', ordered_quantity: 40, received_quantity: 40 }]) // mock updated state
          },
          stockBalanceProjection: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn()
          },
          auditLog: {
            create: vi.fn()
          }
        };
        return callback(tx);
      });

      await service.postGoodsReceipt('grn-1', 'user-1');
      expect(inventoryService.postMovement).toHaveBeenCalled();
      expect(poStatusUpdated).toBe(true);
    });
  });
});
