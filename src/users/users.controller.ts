import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/enums/role.enum';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { usersStorage } from '../common/config/cloudinary.config';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @Roles(Role.ADMIN, Role.COORDINADOR)
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  @Get('election/:electionId')
  @Roles(Role.ADMIN, Role.COORDINADOR)
  findByElection(@Param('electionId') electionId: string): Promise<User[]> {
    return this.usersService.findByElection(electionId);
  }

  @Get('me')
  getMe(@CurrentUser() user: AuthUser) {
    return this.usersService.findOne(user.id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.COORDINADOR)
  findOne(@Param('id') id: string): Promise<User | null> {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.COORDINADOR)
  @UseInterceptors(FileInterceptor('image', { storage: usersStorage }))
  create(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile() file?: any
  ) {
    const imageUrl = file ? file.path : null;
    return this.usersService.create(createUserDto, imageUrl);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.COORDINADOR)
  @UseInterceptors(FileInterceptor('image', { storage: usersStorage }))
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() file?: any
  ) {
    const imageUrl = file ? file.path : undefined;
    return this.usersService.update(id, updateUserDto, imageUrl);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.COORDINADOR)
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.remove(id);
  }
}
