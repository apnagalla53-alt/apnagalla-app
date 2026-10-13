import { Link } from 'react-router-dom';
import { ui } from '../../i18n';

export default function BackupStatus({backup}:{backup:{configured:boolean;provider:string}}) {
  const row=(label:string,value:string)=><div className="r-detail-row"><span>{ui(label)}</span><strong>{ui(value)}</strong></div>;
  return <section className="r-card" aria-label={ui('Backup status')}>
    <h2>{ui('Data Backup')}</h2>
    <h3>{ui(backup.configured?'Backup provider configured':'Backup not configured')}</h3>
    <p className="r-caption">{ui(backup.configured
      ?'Provider configuration detected. Automatic scheduling and restorable backups still require operator verification.'
      :'Cloud backup is not active. No restorable cloud backup is confirmed.')}</p>
    {row('Provider',backup.configured?backup.provider:'Not configured')}
    {row('Last successful backup','Not reported')}
    {row('Restore test','Not reported')}
    {row('Automatic backup schedule','Not reported')}
    {row('Retention policy','Not reported')}
    <p className="r-caption">{ui('Whole-database backups cover business records. Attachment files need separate storage protection. A report export is not a restore archive.')}</p>
    <p className="r-caption">{ui('A configured provider alone does not prove a backup is recent or restorable. Backups and restore checks are managed by the EVOLIX operator.')}</p>
    <p className="r-caption">{ui('Recovery restores the whole database in a controlled environment. Selective shop restore is not available.')}</p>
    <Link className="r-btn r-btn--outline" to="/support">{ui('Ask about backup protection')}</Link>
  </section>;
}
