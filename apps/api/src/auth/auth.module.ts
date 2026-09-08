import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { AuthenticationGuard } from './guards/authentication.guard';
import { RolesGuard } from './guards/roles.guard';
import { AuthorizationService } from './authorization/authorization.service';
import { OwnershipGuard } from './guards/ownership.guard';
import { CooperativeScopeGuard } from './guards/cooperative-scope.guard';
import { CooperativeResourceScopeGuard } from './guards/cooperative-resource-scope.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    PrismaService,
    AuthenticationGuard,
    RolesGuard,
    AuthorizationService,
    OwnershipGuard,
    CooperativeScopeGuard,
    CooperativeResourceScopeGuard,
  ],
  exports: [
    AuthService,
    AuthenticationGuard,
    JwtModule,
    RolesGuard,
    AuthorizationService,
    OwnershipGuard,
    CooperativeScopeGuard,
    CooperativeResourceScopeGuard,
    PrismaService,
  ],
})
export class AuthModule {}
