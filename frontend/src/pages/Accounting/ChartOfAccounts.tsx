import { useState, useEffect } from 'react';
import api from '../../shared/api';
import { Book, Plus, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../shared/store/authStore';

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const activeCompanyId = useAuthStore((s: any) => s.activeCompanyId);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const res = await api.get('/accounting/accounts');
      setAccounts(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [activeCompanyId]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Book className="w-6 h-6 text-blue-500" /> Chart of Accounts
          </h1>
          <p className="text-gray-400 mt-1">Manage all your ledger accounts</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAccounts} className="btn-secondary px-3">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="btn-primary flex items-center gap-2 px-4 py-2">
            <Plus className="w-4 h-4" /> New Account
          </button>
        </div>
      </div>

      <div className="card mt-6">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">Loading accounts...</td>
                </tr>
              ) : accounts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-gray-500">No accounts found.</td>
                </tr>
              ) : (
                accounts.map(acc => (
                  <tr key={acc.id}>
                    <td className="font-mono text-sm">{acc.code}</td>
                    <td className="font-medium text-gray-200">{acc.name}</td>
                    <td>
                      <span className="badge badge-gray">{acc.account_type}</span>
                    </td>
                    <td className="text-right">
                      <a href={`/accounting/ledger/${acc.id}`} className="text-blue-400 hover:underline">
                        View Ledger
                      </a>
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
}

