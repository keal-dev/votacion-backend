import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as child_process from 'child_process';
import * as util from 'util';
import * as fs from 'fs';
import * as path from 'path';

const exec = util.promisify(child_process.exec);

export interface BackupInfo {
  filename: string;
  size: number;
  createdAt: Date;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupFolder = path.join(process.cwd(), 'backups');

  constructor(private readonly configService: ConfigService) {
    if (!fs.existsSync(this.backupFolder)) {
      fs.mkdirSync(this.backupFolder, { recursive: true });
    }
  }

  async createBackup(): Promise<string> {
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<number>('DB_PORT', 5432);
    const username = this.configService.get<string>('DB_USERNAME', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', 'postgres');
    const database = this.configService.get<string>('DB_NAME', 'db_votacion');

    const date = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${database}-${date}.sql`;
    const filepath = path.join(this.backupFolder, filename);

    // Usa la variable de entorno o por defecto el comando del sistema
    const pgDumpPath = this.configService.get<string>('PG_DUMP_PATH', 'pg_dump');
    const command = `"${pgDumpPath}" -h ${host} -p ${port} -U ${username} -d ${database} -F c -f "${filepath}"`;
    
    try {
      this.logger.log(`Starting backup: ${filename}`);
      await exec(command, {
        env: { ...process.env, PGPASSWORD: password }
      });
      this.logger.log(`Backup successfully created at ${filepath}`);
      return filename;
    } catch (error) {
      this.logger.error(`Error creating backup: ${error.message}`);
      // Clean up failed file if it exists
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
      throw new InternalServerErrorException('No se pudo crear el respaldo de la base de datos.');
    }
  }

  async getBackups(): Promise<BackupInfo[]> {
    try {
      const files = fs.readdirSync(this.backupFolder);
      const backups: BackupInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.sql')) {
          const stats = fs.statSync(path.join(this.backupFolder, file));
          backups.push({
            filename: file,
            size: stats.size,
            createdAt: stats.birthtime,
          });
        }
      }

      // Sort by newest first
      return backups.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      this.logger.error(`Error reading backups: ${error.message}`);
      throw new InternalServerErrorException('No se pudieron listar los respaldos.');
    }
  }

  getBackupFilePath(filename: string): string {
    const filepath = path.join(this.backupFolder, filename);
    if (!fs.existsSync(filepath)) {
      throw new NotFoundException('El archivo de respaldo no existe.');
    }
    return filepath;
  }

  async restoreBackup(filename: string): Promise<void> {
    const filepath = this.getBackupFilePath(filename);
    
    const host = this.configService.get<string>('DB_HOST', 'localhost');
    const port = this.configService.get<number>('DB_PORT', 5432);
    const username = this.configService.get<string>('DB_USERNAME', 'postgres');
    const password = this.configService.get<string>('DB_PASSWORD', 'postgres');
    const database = this.configService.get<string>('DB_NAME', 'db_votacion');

    // Usa la variable de entorno o por defecto el comando del sistema
    const pgRestorePath = this.configService.get<string>('PG_RESTORE_PATH', 'pg_restore');
    const command = `"${pgRestorePath}" -h ${host} -p ${port} -U ${username} -d ${database} -c "${filepath}"`;

    try {
      this.logger.log(`Starting restore from: ${filename}`);
      await exec(command, {
        env: { ...process.env, PGPASSWORD: password }
      });
      this.logger.log(`Restore successfully completed from ${filename}`);
    } catch (error) {
      this.logger.error(`Error restoring backup: ${error.message}`);
      throw new InternalServerErrorException('No se pudo restaurar la base de datos. Puede que pg_restore haya devuelto advertencias.');
    }
  }

  async deleteBackup(filename: string): Promise<void> {
    const filepath = this.getBackupFilePath(filename);
    try {
      fs.unlinkSync(filepath);
      this.logger.log(`Backup deleted: ${filename}`);
    } catch (error) {
      this.logger.error(`Error deleting backup: ${error.message}`);
      throw new InternalServerErrorException('No se pudo eliminar el archivo de respaldo.');
    }
  }
}
