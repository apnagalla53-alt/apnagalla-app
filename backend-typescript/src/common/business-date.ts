/** Retail's logical Indian business date; never derive the counter day from UTC. */
export const businessDate=(at=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(at);
