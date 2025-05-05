import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Get the roles required for the specific route handler (from @Roles decorator)
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) {
      // If no @Roles decorator is used, allow access (or deny based on default policy)
      return true;
    }

    // Get the request object from the execution context
    const request = context.switchToHttp().getRequest();

    // Get the user object attached by a previous guard (e.g., JwtAuthGuard)
    const user = request.user;

    // Check if user exists and has a role property
    if (!user || !user.role) {
      // If no user or role is found (e.g., guard order issue or bad token), deny access
      return false;
    }

    // Check if the user's role is included in the list of required roles
    return requiredRoles.some((role) => user.role === role);
  }
}