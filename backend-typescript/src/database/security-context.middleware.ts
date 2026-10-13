import { Injectable, NestMiddleware } from '@nestjs/common';
import { requestDatabaseScope } from './request-scope';
@Injectable()
export class SecurityContextMiddleware implements NestMiddleware {
  use(_req: any, _res: any, next: () => void) {
    requestDatabaseScope.run({ kind: 'unverified' }, next);
  }
}
