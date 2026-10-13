import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, RequestMethod, ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runtimeMetrics } from './platform/runtime-metrics';
import { randomUUID } from 'crypto';
import { allowedBrowserOrigin } from './auth/browser-session';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule,{logger:process.env.NODE_ENV==='production'?new ConsoleLogger({json:true}):undefined});
  app.enableShutdownHooks();
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 8000;
  const frontendOrigin = configService.get<string>('FRONTEND_ORIGIN') || 'http://localhost:5173';
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.getHttpAdapter().getInstance().set('trust proxy',(configService.get<string>('TRUSTED_PROXY_CIDRS')||'loopback').split(',').map(value=>value.trim()));

  // Older ERP/Retail controllers already declare this prefix. Apply it once.
  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'api/v1/{*path}', method: RequestMethod.ALL }],
  });
  
  app.enableCors({
    origin:(origin:string|undefined,callback:(error:Error|null,allow?:boolean)=>void)=>callback(null,!origin||allowedBrowserOrigin(origin)),
    credentials: true,
  });
  app.use((req: any, res: any, next: () => void) => {
    const start = performance.now();
    const requestId = randomUUID();
    req.requestId=requestId;
    res.setHeader('X-Request-ID',requestId);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
    res.on('finish', () => {
      const duration=performance.now()-start;
      runtimeMetrics.record(duration,res.statusCode);
      if(process.env.NODE_ENV==='production') logger.log(JSON.stringify({event:'http',request_id:requestId,method:req.method,
        route:req.route?.path||'unmatched',status:res.statusCode,duration_ms:Math.round(duration),version:process.env.APP_VERSION}));
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
  logger.log(`API listening on port ${port}; version ${process.env.APP_VERSION || 'development'}`);
}
bootstrap();
