import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// US07: same as JwtAuthGuard but lets the request through without a token
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) return null
    return user
  }
}
