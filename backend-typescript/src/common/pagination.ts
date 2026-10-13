import {BadRequestException} from '@nestjs/common';
export function page(query:{limit?:unknown;offset?:unknown}={}) {
  const take=query.limit===undefined?100:Number(query.limit),skip=query.offset===undefined?0:Number(query.offset);
  if(!Number.isInteger(take)||take<1||take>200||!Number.isInteger(skip)||skip<0||skip>1000000)throw new BadRequestException('Use limit 1–200 and a non-negative offset');
  return {take,skip};
}
