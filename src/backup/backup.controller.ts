import { Controller, Get, Post, Delete, Param, UseGuards, Res, HttpStatus } from '@nestjs/common';
import { BackupService } from './backup.service';

import { Role } from '../auth/enums/role.enum';
import * as express from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@Controller('backup')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // Assuming Role.ADMIN exists in user entity
export class BackupController {
  constructor(private readonly backupService: BackupService) { }

  @Get()
  async getBackups() {
    return this.backupService.getBackups();
  }

  @Post('generate')
  async generateBackup() {
    const filename = await this.backupService.createBackup();
    return { message: 'Respaldo generado exitosamente', filename };
  }

  @Get('download/:filename')
  async downloadBackup(@Param('filename') filename: string, @Res() res: express.Response) {
    const filepath = this.backupService.getBackupFilePath(filename);
    const stat = fs.statSync(filepath);

    res.writeHead(HttpStatus.OK, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename=${filename}`,
    });

    const readStream = fs.createReadStream(filepath);
    readStream.pipe(res);
  }

  @Post('restore/:filename')
  async restoreBackup(@Param('filename') filename: string) {
    await this.backupService.restoreBackup(filename);
    return { message: 'Base de datos restaurada exitosamente' };
  }

  @Delete(':filename')
  async deleteBackup(@Param('filename') filename: string) {
    await this.backupService.deleteBackup(filename);
    return { message: 'Respaldo eliminado exitosamente' };
  }
}
