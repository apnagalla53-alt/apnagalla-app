import { useState } from 'react';
import { Settings, Plus } from 'lucide-react';
import api from '../../shared/api';

const StockAdjustments = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    item_id: '',
    godown_id: '',
    quantity: 0,
    adjustment_type: 'IN',
    reason: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const res = await api.post('/inventory/adjustments', {
        adjustment_type: form.adjustment_type,
        narration: form.reason,
        lines: [{
          item_id: form.item_id,
          godown_id: form.godown_id,
          quantity: form.quantity,
          unit_id: 'PCS' // Hardcoded for demo
        }]
      });
      setSuccess(`Adjustment created: ${res.data.document_number}`);
      setForm({ ...form, quantity: 0, reason: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create adjustment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Settings className="h-6 w-6 text-blue-600" />
          Stock Adjustments
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow max-w-2xl">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">New Adjustment</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded">{error}</div>}
          {success && <div className="p-3 bg-green-50 text-green-700 rounded">{success}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Item ID</label>
              <input type="text" required value={form.item_id} onChange={e => setForm({...form, item_id: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="UUID of Item" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Godown ID</label>
              <input type="text" required value={form.godown_id} onChange={e => setForm({...form, godown_id: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="UUID of Godown" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select value={form.adjustment_type} onChange={e => setForm({...form, adjustment_type: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
                <option value="IN">Adjustment IN (+)</option>
                <option value="OUT">Adjustment OUT (-)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Quantity</label>
              <input type="number" min="0.01" step="0.01" required value={form.quantity} onChange={e => setForm({...form, quantity: parseFloat(e.target.value)})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" inputMode="decimal" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700">Reason</label>
              <input type="text" value={form.reason} onChange={e => setForm({...form, reason: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
            </div>
          </div>
          
          <div className="pt-4 flex justify-end">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Post Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StockAdjustments;

