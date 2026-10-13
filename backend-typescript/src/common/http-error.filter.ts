import {Catch,ExceptionFilter,ArgumentsHost,HttpException,Logger} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
@Catch()
export class SafeHttpErrorFilter implements ExceptionFilter {
  private logger=new Logger('HttpError');
  catch(error:any,host:ArgumentsHost){
    const req=host.switchToHttp().getRequest(),res=host.switchToHttp().getResponse();
    const requestId=req.requestId||randomUUID();
    res.setHeader('X-Request-ID',requestId);
    const status=error instanceof HttpException?error.getStatus():500;
    if(status>=500)this.logger.error(JSON.stringify({event:'request_failed',request_id:requestId,kind:error?.constructor?.name||'Error',code:/^P\d{4}$/.test(error?.code)?error.code:undefined,method:req.method,route:req.route?.path,status}));
    const response=status<500&&error instanceof HttpException?error.getResponse():{statusCode:status,message:'The server could not complete this request',request_id:requestId};
    if(status===429&&typeof response==='object'&&'retry_after_seconds' in response)res.setHeader('Retry-After',String(response.retry_after_seconds));
    res.status(status).json(typeof response==='string'?{statusCode:status,message:response}:response);
  }
}
