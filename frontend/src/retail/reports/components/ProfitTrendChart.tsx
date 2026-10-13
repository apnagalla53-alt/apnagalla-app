import { ui, useUiLanguage } from "../../../i18n";
/** Displays only saved report periods; missing periods and unknown costs are never invented. */
export default function ProfitTrendChart({rows}: {rows:any[]}) {
  useUiLanguage();
  const values=rows.flatMap(r=>[Number(r.net_sales),...(r.gross_profit==null?[]:[Number(r.gross_profit)])]);
  const min=Math.min(0,...values),max=Math.max(1,...values),span=max-min;
  const y=(value:number)=>164-(value-min)/span*136;
  const step=400/Math.max(1,rows.length),width=Math.max(1,Math.min(18,step/3));
  return <figure className="r-card" style={{margin:'16px 0'}}>
    <figcaption><strong>Sales and known-cost gross profit</strong><p className="r-caption">Each bar represents an actual reported period. Unknown profit is omitted.</p></figcaption>
    <svg viewBox="0 0 480 200" role="img" aria-label="Net sales and known-cost gross profit by report period" style={{width:'100%',height:'auto'}}>
      <text x="4" y="20" fill="var(--r-text-muted)" fontSize="12">₹{max.toLocaleString('en-IN',{maximumFractionDigits:0})}</text>
      <line x1="64" x2="464" y1={y(0)} y2={y(0)} stroke="var(--r-border)"/>
      {rows.map((r,index)=>{const x=64+(index+.5)*step,profit=r.gross_profit==null?null:Number(r.gross_profit);
        return <g key={r.id||index}>
          <title>{ui(r.label)}: Net sales ₹{r.net_sales}; gross profit {profit==null?'Unknown':'₹'+r.gross_profit}</title>
          <rect x={x-width} y={Math.min(y(0),y(Number(r.net_sales)))} width={width} height={Math.max(1,Math.abs(y(0)-y(Number(r.net_sales))))} fill="var(--r-info)" opacity=".7"/>
          {profit!=null&&<rect x={x+1} y={Math.min(y(0),y(profit))} width={width} height={Math.max(1,Math.abs(y(0)-y(profit)))} fill={profit<0?'var(--r-danger)':'var(--r-primary)'}/>}
        </g>;})}
      <text x="64" y="190" fill="var(--r-text-muted)" fontSize="12">{ui(rows[0]?.label)}</text>
      {rows.length>1&&<text x="464" y="190" textAnchor="end" fill="var(--r-text-muted)" fontSize="12">{ui(rows[rows.length-1]?.label)}</text>}
    </svg>
    <p className="r-caption">Blue: net sales · Green: gross profit · Red: loss. Exact amounts appear below.</p>
  </figure>;
}
