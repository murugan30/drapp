import { Role } from './roles';

export type JwtPayload = {
  sub: string;
  role: Role;
  mobile: string;
};
