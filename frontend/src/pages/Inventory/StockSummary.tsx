import { useEffect, useState } from 'react';
import { Package, Search } from 'lucide-react';
import api from '../../shared/api';

interface StockSummary {
  godown: string;
  item: string;
  sku: string;
  quantity: string;
  unit: string;
}

const StockSummary = () => {
  const [stock, setStock] = useState<StockSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/stock');
      setStock(res.data);
    } catch {
      setError('Failed to load stock summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStock(); }, []);

  const filteredStock = stock.filter(s => 
    s.item.toLowerCase().includes(search.toLowerCase()) || 
    s.sku.toLowerCase().includes(search.toLowerCase()) ||
    s.godown.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Package className="h-6 w-6 text-blue-600" />
          Stock Summary
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items, SKU, or godown..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {error && <div className="p-4 bg-red-50 text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item / SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Godown</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
              ) : filteredStock.length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-4 text-center text-gray-500">No stock records found</td></tr>
              ) : (
                filteredStock.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{row.item}</div>
                      <div className="text-sm text-gray-500">{row.sku}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{row.godown}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">{row.quantity}</span>
                      <span className="text-sm text-gray-500 ml-1">{row.unit}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StockSummary;

