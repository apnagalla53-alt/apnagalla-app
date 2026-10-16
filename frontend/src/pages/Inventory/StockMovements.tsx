import { formatDate } from '../../shared/dateFormat';
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import api from '../../shared/api';

interface StockMovement {
  id: string;
  business_date: string;
  movement_type: string;
  source_document_type: string;
  source_document_id: string;
  quantity: string;
  item: { name: string };
  godown_id: string;
  unit_id: string;
}

const StockMovements = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMovements = async () => {
    setLoading(true);
    try {
      const res = await api.get('/inventory/movements');
      setMovements(res.data);
    } catch {
      setError('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMovements(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Activity className="h-6 w-6 text-blue-600" />
          Stock Movements Ledger
        </h1>
      </div>

      <div className="bg-white rounded-lg shadow">
        {error && <div className="p-4 bg-red-50 text-red-700">{error}</div>}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Movement Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">Loading...</td></tr>
              ) : movements.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-4 text-center text-gray-500">No stock movements found</td></tr>
              ) : (
                movements.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(row.business_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {row.item.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        row.movement_type.includes('IN') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {row.movement_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {row.source_document_type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold">
                      {Number(row.quantity) > 0 ? '+' : ''}{row.quantity}
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

export default StockMovements;

