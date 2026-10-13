import { useState, useEffect } from 'react';
import api from '../../shared/api';

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await api.get('/banking/accounts');
        setAccounts(res.data);
      } catch (e) {
        console.error('Failed to load bank accounts', e);
      }
    };
    fetchAccounts();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bank Accounts</h1>
          <div className="text-muted text-sm">Manage company bank accounts and integrations</div>
        </div>
        <button className="btn btn-primary">Add Bank Account</button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Bank Name</th>
              <th>Account Number</th>
              <th>IFSC</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc, i) => (
              <tr key={i}>
                <td className="font-semibold text-primary">{acc.bank_name}</td>
                <td>{acc.account_number}</td>
                <td>{acc.ifsc_code}</td>
                <td>
                  <span className={`badge ${acc.is_active ? 'badge-success' : 'badge-warning'}`}>
                    {acc.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm">Reconcile</button>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted p-4">No bank accounts configured.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

