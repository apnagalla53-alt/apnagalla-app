import { formatDate } from '../../shared/dateFormat';
import { useState, useEffect } from 'react';
import { Search, Plus, Printer, RefreshCw, Check, Trash2, Tag, Layers, FileText } from 'lucide-react';
import api from '../../shared/api';
import { useAuthStore } from '../../shared/store/authStore';

export default function BarcodeLabels() {
  const activeCompanyId = useAuthStore((s: any) => s.activeCompanyId);
  const [activeTab, setActiveTab] = useState<'manage' | 'print' | 'inward' | 'templates'>('manage');

  // Search & Item state
  const [searchItem, setSearchItem] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [barcodes, setBarcodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // New barcode modal / form
  const [newBarcode, setNewBarcode] = useState('');
  const [barcodeType, setBarcodeType] = useState('CODE128');
  const [isPrimary, setIsPrimary] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  // Print state
  const [printQuantity, setPrintQuantity] = useState(1);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [printPreview, setPrintPreview] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);

  // Inward state
  const [grns, setGrns] = useState<any[]>([]);
  const [selectedGrnId, setSelectedGrnId] = useState('');
  const [grnDetail, setGrnDetail] = useState<any>(null);
  const [lineQuantities, setLineQuantities] = useState<{ [key: string]: number }>({});
  const [inwardResult, setInwardResult] = useState<any>(null);

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const res = await api.get('/api/v1/barcodes/templates');
      setTemplates(res.data || []);
      if (res.data?.length > 0 && !selectedTemplateId) {
        const def = res.data.find((t: any) => t.is_default) || res.data[0];
        setSelectedTemplateId(def.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Search items
  const handleSearchItems = async () => {
    if (!searchItem.trim()) return;
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/barcodes/lookup/${encodeURIComponent(searchItem.trim())}`);
      if (res.data) {
        handleSelectItem(res.data);
      }
    } catch {
      setSelectedItem(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectItem = async (item: any) => {
    setSelectedItem(item);
    setAssignError('');
    setAssignSuccess('');
    try {
      const res = await api.get(`/api/v1/barcodes/item/${item.id}`);
      setBarcodes(res.data || []);
    } catch (e) {
      console.error(e);
      setBarcodes([]);
    }
  };

  const handleGenerateBarcode = async () => {
    try {
      const res = await api.post('/api/v1/barcodes/generate', {
        type: barcodeType,
      });
      if (res.data?.barcode) {
        setNewBarcode(res.data.barcode);
      }
    } catch (e: any) {
      setAssignError(e.response?.data?.message || 'Failed to generate barcode');
    }
  };

  const handleAssignBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !newBarcode.trim()) return;
    setAssignError('');
    setAssignSuccess('');
    try {
      await api.post('/api/v1/barcodes/assign', {
        item_id: selectedItem.id,
        barcode: newBarcode.trim(),
        barcode_type: barcodeType,
        is_primary: isPrimary,
      });
      setAssignSuccess(`Barcode "${newBarcode.trim()}" assigned successfully!`);
      setNewBarcode('');
      // Reload barcodes
      handleSelectItem(selectedItem);
    } catch (e: any) {
      setAssignError(e.response?.data?.message || 'Failed to assign barcode');
    }
  };

  const handleSetPrimary = async (barcodeId: string) => {
    try {
      await api.patch(`/api/v1/barcodes/${barcodeId}/primary`);
      handleSelectItem(selectedItem);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error setting primary');
    }
  };

  const handleDeactivate = async (barcodeId: string) => {
    try {
      await api.patch(`/api/v1/barcodes/${barcodeId}/deactivate`);
      handleSelectItem(selectedItem);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error deactivating barcode');
    }
  };

  const handleDelete = async (barcodeId: string) => {
    if (!confirm('Are you sure you want to delete this barcode?')) return;
    try {
      await api.delete(`/api/v1/barcodes/${barcodeId}`);
      handleSelectItem(selectedItem);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error deleting barcode');
    }
  };

  // Label preview
  const handleGeneratePreview = async () => {
    if (!selectedItem) return;
    try {
      setLoading(true);
      const res = await api.post('/api/v1/barcodes/labels/product', {
        item_id: selectedItem.id,
        quantity: Number(printQuantity) || 1,
        template_id: selectedTemplateId || undefined,
      });
      setPrintPreview(res.data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Failed to generate labels');
    } finally {
      setLoading(false);
    }
  };

  // Inward GRN fetch
  const fetchGRNs = async () => {
    try {
      const companyId = activeCompanyId || '00000000-0000-0000-0000-000000000000';
      const res = await api.get(`/purchase/receipts?company_id=${companyId}`);
      setGrns(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectGrn = async (grnId: string) => {
    setSelectedGrnId(grnId);
    setInwardResult(null);
    try {
      const res = await api.get(`/purchase/receipts/${grnId}`);
      setGrnDetail(res.data);
      // Init line quantities to received quantities
      const initial: { [key: string]: number } = {};
      res.data?.lines?.forEach((l: any) => {
        initial[l.id] = Number(l.received_quantity);
      });
      setLineQuantities(initial);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintInward = async () => {
    if (!selectedGrnId || !grnDetail) return;
    try {
      setLoading(true);
      const lines = Object.entries(lineQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({
          goods_receipt_line_id: id,
          quantity: Number(qty),
        }));

      if (lines.length === 0) {
        alert('Please specify quantity > 0 for at least one item');
        return;
      }

      const res = await api.post('/api/v1/barcodes/labels/inward', {
        goods_receipt_id: selectedGrnId,
        lines,
      });
      setInwardResult(res.data);
    } catch (e: any) {
      alert(e.response?.data?.message || 'Error generating inward labels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchGRNs();
  }, [activeCompanyId]);

  return (
    <div className="p-6">
      <div className="page-header mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Tag size={24} className="text-primary" /> Barcode & Labels
          </h1>
          <div className="text-muted text-sm">
            Manage multi-barcodes, product labels, MRP labels, and inward receipt barcodes.
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-4 border-b border-border mb-6">
        <button
          className={`pb-3 font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === 'manage'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
          onClick={() => setActiveTab('manage')}
        >
          <Layers size={18} /> Barcode Management
        </button>
        <button
          className={`pb-3 font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === 'print'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
          onClick={() => setActiveTab('print')}
        >
          <Printer size={18} /> Product & MRP Labels
        </button>
        <button
          className={`pb-3 font-medium flex items-center gap-2 border-b-2 transition ${
            activeTab === 'inward'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-foreground'
          }`}
          onClick={() => setActiveTab('inward')}
        >
          <FileText size={18} /> Inward GRN Printing
        </button>
      </div>

      {/* Tab 1: Barcode Management */}
      {activeTab === 'manage' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Item Lookup</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                className="form-control flex-1"
                placeholder="Scan or enter SKU / Barcode..."
                value={searchItem}
                onChange={(e) => setSearchItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchItems()}
              />
              <button className="btn btn-primary" onClick={handleSearchItems} disabled={loading}>
                <Search size={16} />
              </button>
            </div>

            {selectedItem && (
              <div className="p-3 bg-secondary/20 rounded border border-border">
                <div className="font-semibold text-primary">{selectedItem.name}</div>
                <div className="text-xs text-muted mt-1">SKU: {selectedItem.sku}</div>
                <div className="text-xs text-muted">
                  MRP: ₹{Number(selectedItem.mrp || 0).toFixed(2)} | Unit: {selectedItem.primary_unit?.name || 'Unit'}
                </div>
              </div>
            )}
          </div>

          <div className="card md:col-span-2">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Registered Barcodes</h2>
              {selectedItem && (
                <span className="badge badge-primary">{barcodes.length} Barcode(s)</span>
              )}
            </div>

            {!selectedItem ? (
              <p className="text-muted text-center py-8">Select or scan an item to view and manage its barcodes.</p>
            ) : (
              <div>
                <table className="table mb-6">
                  <thead>
                    <tr>
                      <th>Barcode</th>
                      <th>Type</th>
                      <th>Primary</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barcodes.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-4 text-muted">
                          No barcodes assigned yet. Assign or generate one below.
                        </td>
                      </tr>
                    ) : (
                      barcodes.map((b) => (
                        <tr key={b.id}>
                          <td className="font-mono font-bold">{b.barcode}</td>
                          <td><span className="badge">{b.barcode_type}</span></td>
                          <td>
                            {b.is_primary ? (
                              <span className="badge badge-success flex items-center gap-1 w-max">
                                <Check size={12} /> Primary
                              </span>
                            ) : (
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => handleSetPrimary(b.id)}
                                disabled={!b.is_active}
                              >
                                Set Primary
                              </button>
                            )}
                          </td>
                          <td>
                            <span className={`badge ${b.is_active ? 'badge-primary' : 'badge-danger'}`}>
                              {b.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              {b.is_active && (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => handleDeactivate(b.id)}
                                >
                                  Deactivate
                                </button>
                              )}
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(b.id)}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {/* Form to Assign New Barcode */}
                <form onSubmit={handleAssignBarcode} className="border-t border-border pt-4">
                  <h3 className="font-semibold text-sm mb-3">Assign or Generate Barcode</h3>
                  {assignError && <div className="text-danger text-sm mb-2">{assignError}</div>}
                  {assignSuccess && <div className="text-success text-sm mb-2">{assignSuccess}</div>}

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                    <div className="md:col-span-2">
                      <label className="text-xs text-muted block mb-1">Barcode Value</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="form-control"
                          placeholder="Scan or enter code..."
                          value={newBarcode}
                          onChange={(e) => setNewBarcode(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-secondary flex items-center gap-1"
                          onClick={handleGenerateBarcode}
                          title="Generate Unique Code"
                        >
                          <RefreshCw size={14} /> Auto
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted block mb-1">Format</label>
                      <select
                        className="form-control"
                        value={barcodeType}
                        onChange={(e) => setBarcodeType(e.target.value)}
                      >
                        <option value="CODE128">CODE 128</option>
                        <option value="EAN13">EAN-13</option>
                        <option value="INTERNAL">Internal</option>
                        <option value="SUPPLIER">Supplier</option>
                        <option value="QR">QR Code</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input
                        type="checkbox"
                        id="isPrimaryCheck"
                        checked={isPrimary}
                        onChange={(e) => setIsPrimary(e.target.checked)}
                      />
                      <label htmlFor="isPrimaryCheck" className="text-sm cursor-pointer">
                        Set as Primary
                      </label>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary flex items-center gap-1">
                    <Plus size={16} /> Assign Barcode
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Product & MRP Labels */}
      {activeTab === 'print' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card">
            <h2 className="text-lg font-semibold mb-3">Print Configuration</h2>
            <div className="mb-4">
              <label className="text-xs text-muted block mb-1">Selected Item</label>
              {selectedItem ? (
                <div className="font-semibold text-primary">{selectedItem.name}</div>
              ) : (
                <div className="text-muted text-sm">Please select an item in the Management tab first.</div>
              )}
            </div>

            <div className="mb-4">
              <label className="text-xs text-muted block mb-1">Label Quantity</label>
              <input
                type="number"
                min="1"
                max="1000"
                className="form-control"
                value={printQuantity}
                onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))} inputMode="decimal"
              />
            </div>

            <div className="mb-6">
              <label className="text-xs text-muted block mb-1">Label Template</label>
              <select
                className="form-control"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.width_mm}x{t.height_mm}mm - {t.paper_type})
                  </option>
                ))}
                {templates.length === 0 && <option value="">Standard 50x25mm Roll</option>}
              </select>
            </div>

            <button
              className="btn btn-primary w-full flex items-center justify-center gap-2"
              onClick={handleGeneratePreview}
              disabled={!selectedItem || loading}
            >
              <Printer size={16} /> Generate Preview & Payload
            </button>
          </div>

          <div className="card md:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Print Preview & Payloads</h2>

            {!printPreview ? (
              <p className="text-muted text-center py-12">
                Configure quantity and click generate to inspect printable HTML and thermal commands.
              </p>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <span className="font-semibold">{printPreview.item_name}</span>
                    <span className="text-muted text-xs block">
                      Barcode: {printPreview.barcode} | MRP: ₹{printPreview.mrp} | Qty: {printPreview.quantity}
                    </span>
                  </div>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      const printWindow = window.open('', '_blank');
                      if (printWindow) {
                        printWindow.document.write(printPreview.printable_html);
                        printWindow.document.close();
                        printWindow.focus();
                        printWindow.print();
                      }
                    }}
                  >
                    <Printer size={16} /> Print to Device
                  </button>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold mb-2">Printable HTML Preview</h3>
                  <iframe
                    title="Product label preview"
                    sandbox=""
                    srcDoc={printPreview.printable_html}
                    className="border border-border p-4 rounded bg-white overflow-auto max-h-64"
                    style={{ width: '100%', height: 256 }}
                  />
                </div>

                <div>
                  <h3 className="text-sm font-semibold mb-2">Thermal ZPL Commands</h3>
                  <pre className="bg-slate-900 text-green-400 p-3 rounded text-xs overflow-auto max-h-40 font-mono">
                    {printPreview.thermal_payload?.zpl}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Inward GRN Printing */}
      {activeTab === 'inward' && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Inward Receipt Barcode Generation</h2>
          <p className="text-muted text-sm mb-4">
            Print product and batch labels based strictly on authoritative Goods Receipts (GRN).
          </p>

          <div className="max-w-md mb-6">
            <label className="text-xs text-muted block mb-1">Select Goods Receipt (GRN)</label>
            <select
              className="form-control"
              value={selectedGrnId}
              onChange={(e) => handleSelectGrn(e.target.value)}
            >
              <option value="">-- Choose GRN --</option>
              {grns.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.document_number} - {g.party?.name || 'Supplier'} ({formatDate(g.document_date)})
                </option>
              ))}
            </select>
          </div>

          {grnDetail && (
            <div>
              <table className="table mb-6">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Received Qty</th>
                    <th>Batch #</th>
                    <th>Expiry Date</th>
                    <th>Label Print Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {grnDetail.lines?.map((line: any) => (
                    <tr key={line.id}>
                      <td className="font-semibold">{line.item?.name || 'Item'}</td>
                      <td>{Number(line.received_quantity)}</td>
                      <td>{line.batch_number || '-'}</td>
                      <td>{line.expiry_date ? formatDate(line.expiry_date) : '-'}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={Number(line.received_quantity)}
                          className="form-control w-28"
                          value={lineQuantities[line.id] ?? Number(line.received_quantity)}
                          onChange={(e) =>
                            setLineQuantities({
                              ...lineQuantities,
                              [line.id]: Math.min(
                                Number(line.received_quantity),
                                Math.max(0, parseInt(e.target.value) || 0)
                              ),
                            })
                          } inputMode="decimal"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted">
                  Strictly validates that requested label count cannot exceed received stock.
                </span>
                <button className="btn btn-primary flex items-center gap-2" onClick={handlePrintInward} disabled={loading}>
                  <Printer size={16} /> Generate Inward Labels
                </button>
              </div>

              {inwardResult && (
                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold">
                      Generated {inwardResult.total_labels_requested} Inward Labels for {inwardResult.document_number}
                    </h3>
                    <button
                      className="btn btn-success btn-sm"
                      onClick={() => {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(inwardResult.printable_html);
                          printWindow.document.close();
                          printWindow.focus();
                          printWindow.print();
                        }
                      }}
                    >
                      <Printer size={14} /> Print Inward Labels
                    </button>
                  </div>
                  <iframe
                    title="Inward label preview"
                    sandbox=""
                    srcDoc={inwardResult.printable_html}
                    className="border border-border p-4 rounded bg-white overflow-auto max-h-64"
                    style={{ width: '100%', height: 256 }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

