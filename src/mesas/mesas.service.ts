import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Local } from './entities/local.entity';
import { Mesa } from './entities/mesa.entity';
import { Election } from '../elections/entities/election.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../auth/enums/role.enum';
import * as streamifier from 'streamifier';
const csv = require('csv-parser');

@Injectable()
export class MesasService {
  constructor(
    @InjectRepository(Local)
    private readonly localRepository: Repository<Local>,
    @InjectRepository(Mesa)
    private readonly mesaRepository: Repository<Mesa>,
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) { }

  async processCsv(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se ha proporcionado ningún archivo');

    // Buscar la elección activa
    const activeElection = await this.electionRepository.findOneBy({ activa: true });
    if (!activeElection) {
      throw new BadRequestException('No hay ninguna elección activa. Activa una elección antes de importar mesas.');
    }

    const rows: any[] = [];

    // Leer el archivo en memoria y parsearlo
    return new Promise((resolve, reject) => {
      streamifier.createReadStream(file.buffer)
        .pipe(csv({ 
          separator: ';',
          mapHeaders: ({ header, index }) => header.trim().replace(/^[\uFEFF\u200B]/g, '')
        })) // Asumimos punto y coma y removemos BOM
        .on('data', (data) => rows.push(data))
        .on('end', async () => {
          try {
            await this.saveData(rows, activeElection);
            resolve({ message: 'Datos importados correctamente', count: rows.length });
          } catch (error) {
            console.error('Error procesando CSV:', error);
            reject(new BadRequestException('Error al procesar el archivo CSV. Verifica el formato de las columnas.'));
          }
        })
        .on('error', (error) => {
          reject(new BadRequestException('Error leyendo el archivo CSV: ' + error.message));
        });
    });
  }

  private async saveData(rows: any[], election: Election) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Agrupar locales en memoria para evitar múltiples llamadas a DB
      const localesMap = new Map<string, Local>();

      // Mapear los locales existentes de la base de datos (para no duplicar)
      // Idealmente, se podría hacer un find(), pero si son muchos, es mejor ir insertando o buscando por nombre

      for (const row of rows) {
        // Aseguramos que los nombres de las columnas coincidan con las del CSV
        const region = row['REGION'] || row['region'];
        const provincia = row['PROVINCIA'] || row['provincia'];
        const distrito = row['DISTRITO'] || row['distrito'];
        const centroPoblado = row['CENTRO_POBLADO'] || row['centro_poblado'] || null;
        const localNombre = row['LOCAL_NOMBRE'] || row['local_nombre'];
        const localDireccion = row['LOCAL_DIRECCION'] || row['local_direccion'];
        const mesaNumero = row['MESA_NUMERO'] || row['mesa_numero'];
        const cantidadElectores = parseInt(row['CANTIDAD_ELECTORES'] || row['cantidad_electores']) || 0;

        if (!localNombre || !mesaNumero) continue; // Saltar filas vacías o inválidas

        // Clave única para el local (podrían haber locales con el mismo nombre en diferentes distritos)
        const localKey = `${region}-${provincia}-${distrito}-${localNombre}`.toLowerCase();

        let local: Local | null | undefined = localesMap.get(localKey);

        if (!local) {
          // Buscar en DB dentro de la transacción por si acaso ya existe
          local = await queryRunner.manager.findOne(Local, {
            where: { nombre: localNombre, distrito, provincia, region }
          });

          if (!local) {
            // Si no existe, crearlo
            local = queryRunner.manager.create(Local, {
              nombre: localNombre,
              direccion: localDireccion,
              region,
              provincia,
              distrito,
              centro_poblado: centroPoblado
            });
            local = await queryRunner.manager.save(Local, local);
          }

          localesMap.set(localKey, local);
        }

        // 2. Crear o actualizar la mesa
        let mesa = await queryRunner.manager.findOne(Mesa, {
          where: { numero_mesa: mesaNumero, election: { id: election.id } }
        });

        if (mesa) {
          // Si la mesa ya existe en esta elección, solo actualizamos los electores y el local
          mesa.cantidad_electores = cantidadElectores;
          mesa.local = local;
        } else {
          // Si no existe, la creamos nueva
          mesa = queryRunner.manager.create(Mesa, {
            numero_mesa: mesaNumero,
            cantidad_electores: cantidadElectores,
            local: local,
            election: election
          });
        }

        await queryRunner.manager.save(Mesa, mesa);
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Métodos básicos para consultar
  async findAllMesasByElection(electionId: string): Promise<Mesa[]> {
    return this.mesaRepository.find({
      where: { election: { id: electionId } },
      relations: { local: true, personero: true },
      order: { numero_mesa: 'ASC' }
    });
  }

  async findByPersonero(personeroId: string): Promise<Mesa[]> {
    const activeElection = await this.electionRepository.findOne({ where: { activa: true } });
    if (!activeElection) return [];

    return this.mesaRepository.find({
      where: { 
        personero: { id: personeroId },
        election: { id: activeElection.id }
      },
      relations: { 
        local: true, 
        actas: {
          votos: {
            candidato: {
              partido: true
            }
          },
          fotos: true
        } 
      },
      order: { numero_mesa: 'ASC' }
    });
  }

  async assignPersonero(mesaId: string, personeroId: string | null): Promise<Mesa> {
    const mesa = await this.mesaRepository.findOneBy({ id: mesaId });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    if (personeroId) {
      const personero = await this.userRepository.findOneBy({ id: personeroId });
      if (!personero) throw new NotFoundException('Personero no encontrado');
      if (personero.role === Role.COORDINADOR) {
        throw new BadRequestException('No se puede asignar una mesa a un coordinador');
      }
      mesa.personero = { id: personeroId } as any;
    } else {
      mesa.personero = null;
    }

    return this.mesaRepository.save(mesa);
  }

  async getUbicaciones() {
    const queryBuilder = this.localRepository.createQueryBuilder('local');
    const ubicaciones = await queryBuilder
      .select(['local.region AS region', 'local.provincia AS provincia', 'local.distrito AS distrito'])
      .distinct(true)
      .orderBy('local.region', 'ASC')
      .addOrderBy('local.provincia', 'ASC')
      .addOrderBy('local.distrito', 'ASC')
      .getRawMany();
      
    return ubicaciones;
  }

  async getLocalesNombres() {
    const locales = await this.localRepository.find({
      select: {
        id: true,
        nombre: true,
        centro_poblado: true
      },
      order: { nombre: 'ASC' }
    });
    // Remove duplicates based on ID or name if needed, but since they are locales from the DB, just return them.
    return locales.map(l => ({
      id: l.id,
      nombre: l.nombre,
      centro_poblado: l.centro_poblado
    }));
  }
}
