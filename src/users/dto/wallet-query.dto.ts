import { PaginationDto } from '../../common/dto/pagination.dto';

/** Query for GET /users/me/wallet — default page 1, limit 20 via service. */
export class WalletQueryDto extends PaginationDto {}
