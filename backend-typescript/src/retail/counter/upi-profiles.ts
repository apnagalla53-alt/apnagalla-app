import { BadRequestException } from '@nestjs/common';
export type ReceivingProfile={id:string;label:string;upi_id:string;payee_name:string;mobile?:string;show_on_invoice:boolean};
export const upiAddress=/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
export function receivingProfiles(config:any):ReceivingProfile[]{
  if(Array.isArray(config?.profiles))return config.profiles;
  return config?.upi_id?[{id:'primary',label:'Primary account',upi_id:config.upi_id,payee_name:config.payee_name,mobile:config.mobile,show_on_invoice:config.show_on_invoice!==false}]:[];
}
export function receivingView(config:any,id?:string){
  const profiles=receivingProfiles(config),selected=profiles.find(p=>p.id===(id||config?.default_profile_id))||(!id?profiles[0]:undefined);
  if(id&&!selected)throw new BadRequestException('This receiving account is unavailable. Choose another account.');
  return {...selected,profiles,default_profile_id:config?.default_profile_id||profiles[0]?.id,configured:!!selected,bank_verified:false,automatic_confirmation:false};
}
export function paymentRecipient(config:any,payment:any){
  if(payment.payment_method!=='UPI'){
    if(payment.receiving_profile_id||payment.received_on_mobile)throw new BadRequestException('Receiving UPI details belong to UPI payments only.');
    return {};
  }
  if(payment.received_on_mobile){
    if(!/^[6-9]\d{9}$/.test(payment.received_on_mobile)||payment.receiving_profile_id)throw new BadRequestException('Enter one valid 10-digit receiving mobile number.');
    if(!payment.receipt_confirmed)throw new BadRequestException('Confirm the payment was received.');
    return {received_on_mobile:payment.received_on_mobile,receipt_confirmed:true,bank_verified:false};
  }
  if(payment.receiving_profile_id){
    if(!payment.receipt_confirmed)throw new BadRequestException('Confirm the payment was received.');
    const profile=receivingView(config,payment.receiving_profile_id);
    return {receiving_profile_id:profile.id,receiving_label:profile.label,receiving_upi_id:profile.upi_id,receiving_payee_name:profile.payee_name,receipt_confirmed:true,bank_verified:false};
  }
  return payment.receipt_confirmed?{receipt_confirmed:true,bank_verified:false}:{};
}
