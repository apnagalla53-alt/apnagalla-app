import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../shared/api';
import { BookOpen, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../shared/store/authStore';

export default function Ledger() {
  const { id } = useParams();
  const [lines, setLines] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const activeCompanyId = useAuthStore((s: any) => s.activeCompanyId);

  const fetchLedger = async () => {
    try {
      setLoading(true);
      const [balRes, ledRes] = await Promise.all([
        api.get(`/accounting/accounts/${id}/balance`),
        api.get(`/accounting/ledger/${id}`)
      ]);
      setBalance(balRes.data);
      setLines(ledRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchLedger();
  }, [id, activeCompanyId]);

  return (
    <div className="page-container">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/accounting/accounts" className="btn-secondary p-2">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-purple-500" /> 
            {balance ? `${balance.code} - ${balance.name}` : 'Ledger'}
          </h1>
          <p className="text-gray-400 mt-1">General Ledger Statement</p>
        </div>
      </div>

      {balance && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="card bg-gray-800/50">
            <p className="text-sm text-gray-400">Total Debit</p>
            <p className="text-2xl font-mono text-gray-200 mt-1">{Number(balance.total_debit).toFixed(2)}</p>
          </div>
          <div className="card bg-gray-800/50">
            <p className="text-sm text-gray-400">Total Credit</p>
            <p className="text-2xl font-mono text-gray-200 mt-1">{Number(balance.total_credit).toFixed(2)}</p>
          </div>
          <div className="card border border-purple-500/30 bg-purple-500/10">
            <p className="text-sm text-purple-400">Net Balance ({balance.normal_balance})</p>
            <p className="text-3xl font-mono font-bold text-white mt-1">
              {Number(balance.net_balance).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher No</th>
                <th>Type</th>
                <th>Party</th>
                <th>Narration</th>
                <th className="text-right">Debit</th>
                <th className="text-right">Credit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">Loading ledger...</td>
                </tr>
              ) : lines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">No transactions found.</td>
                </tr>
              ) : (
                lines.map(line => (
                  <tr key={line.id}>
                    <td className="text-sm text-gray-400">
                      {new Date(line.voucher.voucher_date).toLocaleDateString()}
                    </td>
                    <td className="font-mono text-sm text-blue-400">
                      {line.voucher.document_number}
                    </td>
                    <td><span className="badge badge-gray">{line.voucher.voucher_type}</span></td>
                    <td className="text-gray-300">{line.party?.name || '-'}</td>
                    <td className="text-gray-400 text-sm max-w-xs truncate" title={line.narration || line.voucher.narration}>
                      {line.narration || line.voucher.narration || '-'}
                    </td>
                    <td className="text-right font-mono text-gray-200">
                      {Number(line.debit) > 0 ? Number(line.debit).toFixed(2) : '-'}
                    </td>
                    <td className="text-right font-mono text-gray-200">
                      {Number(line.credit) > 0 ? Number(line.credit).toFixed(2) : '-'}
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

