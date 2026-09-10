import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Setting)
    private readonly settingsRepository: Repository<Setting>,
  ) {}

  // Se ejecuta automáticamente cuando la app inicia
  async onModuleInit() {
    await this.ensureSettingsExist();
  }

  private async ensureSettingsExist() {
    const count = await this.settingsRepository.count();
    if (count === 0) {
      const defaultSettings = this.settingsRepository.create();
      await this.settingsRepository.save(defaultSettings);
      console.log('Configuración global inicializada con valores por defecto.');
    }
  }

  async getSettings(): Promise<Setting> {
    const settings = await this.settingsRepository.find();
    if (settings.length === 0) {
      await this.ensureSettingsExist();
      return (await this.settingsRepository.find())[0];
    }
    return settings[0];
  }

  async updateSettings(updateSettingDto: UpdateSettingDto): Promise<Setting> {
    const currentSettings = await this.getSettings();
    const updated = this.settingsRepository.merge(currentSettings, updateSettingDto);
    // Para manejar explícitamente el null de global_announcement
    if (updateSettingDto.global_announcement === null) {
      updated.global_announcement = null;
    }
    return this.settingsRepository.save(updated);
  }
}
