export function safeReturnTo(state:unknown,fallback='/retail/home'){
  const value=(state as any)?.returnTo;
  return typeof value==='string'&&/^\/retail\//.test(value)&&!/[\\\x00-\x20]/.test(value)?value:fallback;
}
