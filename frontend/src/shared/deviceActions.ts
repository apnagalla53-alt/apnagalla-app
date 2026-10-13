import { Capacitor, registerPlugin } from '@capacitor/core';
const device = registerPlugin<{
  printPage(): Promise<void>;
  printQr(options:{png:string;title:string;subtitle:string}): Promise<void>;
  shareQr(options:{png:string;title:string}): Promise<void>;
  openWhatsApp(options:{url:string}): Promise<void>;
}>('EvolixDevice');
export const nativeDeviceActions = () => Capacitor.getPlatform()==='android' && Capacitor.isPluginAvailable('EvolixDevice');
export async function printInvoice() { if(nativeDeviceActions())await device.printPage();else window.print(); }
export async function printShopQr(png:string,title:string,subtitle:string) { if(nativeDeviceActions())await device.printQr({png,title,subtitle});else window.print(); }
export async function shareShopQr(png:string,title:string) { await device.shareQr({png,title}); }
export async function openWhatsAppChat(url:string){await device.openWhatsApp({url});}
