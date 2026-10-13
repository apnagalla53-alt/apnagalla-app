export function googleOriginSupported(origin:string) {
  try {
    const url=new URL(origin),host=url.hostname;
    if(['localhost','127.0.0.1','[::1]'].includes(host))return ['http:','https:'].includes(url.protocol);
    return url.protocol==='https:'&&!/^\d+\.\d+\.\d+\.\d+$/.test(host)&&!host.includes(':');
  }catch{return false;}
}
