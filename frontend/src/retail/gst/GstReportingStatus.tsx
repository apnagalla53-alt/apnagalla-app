import { ShieldAlert } from 'lucide-react';
import { StatusCard } from '../design/StitchComponents';
import type { GstProfile } from './types';
import { ui } from '../../i18n';
export default function GstReportingStatus({profile}:{profile:GstProfile}) {
  if(profile.electronic_reporting==='NOT_REQUIRED')return null;
  return <div role="status" className="gst-no-print"><StatusCard Icon={ShieldAlert} tone="warning" title={profile.electronic_reporting==='REQUIRED'?'Electronic reporting required':'Electronic reporting uncertain'} description="Government IRN connection is not configured. This invoice cannot be issued until the required reporting is supported."><p className="r-caption">{ui('Review electronic-reporting applicability in Business Details with your accountant.')}</p></StatusCard></div>;
}
