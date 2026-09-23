import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Partido } from './entities/partido.entity';
import { Election } from '../elections/entities/election.entity';
import { v2 as cloudinary } from 'cloudinary';
import csv from 'csv-parser';
import * as streamifier from 'streamifier';

@Injectable()
export class PartidosService {
  constructor(
    @InjectRepository(Partido)
    private readonly partidoRepository: Repository<Partido>,
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
    private readonly dataSource: DataSource,
  ) { }

  private async deleteCloudinaryImage(url: string) {
    if (!url || !url.includes('cloudinary.com')) return;
    try {
      // Extraer el public_id de la URL (ej: "votacion_logos/nombrearchivo")
      const parts = url.split('/');
      const filenameWithExt = parts[parts.length - 1];
      const folder = parts[parts.length - 2];
      const filename = filenameWithExt.split('.')[0];
      const publicId = `${folder}/${filename}`;
      
      await cloudinary.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error al intentar eliminar imagen de Cloudinary:', error);
    }
  }

  async create(data: { nombre: string; siglas: string; logoUrl: string | null; electionId: string }) {
    const election = await this.electionRepository.findOneBy({ id: data.electionId });
    if (!election) throw new NotFoundException('Elección no encontrada');

    // Validación: No permitir nombres duplicados en la misma elección
    const existing = await this.partidoRepository.findOne({ 
      where: { nombre: data.nombre, election: { id: data.electionId } } 
    });
    if (existing) {
      throw new ConflictException(`Ya existe una organización política con el nombre "${data.nombre}" en esta elección.`);
    }

    const partido = this.partidoRepository.create({
      nombre: data.nombre,
      siglas: data.siglas,
      logo_url: data.logoUrl || null,
      election: election
    });

    return this.partidoRepository.save(partido);
  }

  async createManyFromCsv(electionId: string, fileBuffer: Buffer): Promise<any> {
    const election = await this.electionRepository.findOneBy({ id: electionId });
    if (!election) throw new NotFoundException('Elección no encontrada');

    const results: any[] = [];

    // Convertir el buffer a un stream y parsear el CSV
    await new Promise((resolve, reject) => {
      streamifier.createReadStream(fileBuffer)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      throw new BadRequestException('El archivo CSV está vacío o no tiene el formato correcto (recuerde usar las cabeceras "nombre" y "siglas").');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingNamesInDb = await queryRunner.manager.find(Partido, {
        where: { election: { id: electionId } },
        select: { nombre: true }
      });
      const dbNamesSet = new Set(existingNamesInDb.map(p => p.nombre.toLowerCase().trim()));
      const currentCsvNamesSet = new Set<string>();

      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        // Para que la fila coincida con la vista en Excel (usualmente fila 1 son cabeceras, fila 2 es el primer dato)
        const rowNumber = i + 2;

        const nombre = row.nombre?.trim();
        const siglas = row.siglas?.trim();

        if (!nombre) {
          throw new BadRequestException(`Error en la fila ${rowNumber}: El campo "nombre" es obligatorio.`);
        }
        if (!siglas) {
          throw new BadRequestException(`Error en la fila ${rowNumber}: El campo "siglas" es obligatorio.`);
        }

        const nombreLower = nombre.toLowerCase();

        if (dbNamesSet.has(nombreLower)) {
          throw new BadRequestException(`Error en la fila ${rowNumber}: Ya existe una organización política con el nombre "${nombre}" en esta elección.`);
        }

        if (currentCsvNamesSet.has(nombreLower)) {
          throw new BadRequestException(`Error en la fila ${rowNumber}: El nombre "${nombre}" está duplicado dentro del mismo archivo CSV.`);
        }

        currentCsvNamesSet.add(nombreLower);

        const newPartido = queryRunner.manager.create(Partido, {
          nombre,
          siglas,
          logo_url: null,
          election
        });

        await queryRunner.manager.save(newPartido);
      }

      await queryRunner.commitTransaction();
      return { message: `Se importaron ${results.length} organizaciones políticas exitosamente.` };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findByElection(electionId: string) {
    return this.partidoRepository.find({
      where: { election: { id: electionId } },
      order: { orden: 'ASC', nombre: 'ASC' }
    });
  }

  async update(id: string, data: { nombre?: string; siglas?: string; logoUrl?: string | null }) {
    const partido = await this.partidoRepository.findOne({
      where: { id },
      relations: { election: true }
    });
    if (!partido) throw new NotFoundException('Partido no encontrado');

    if (data.nombre && data.nombre !== partido.nombre) {
      // Validación: No permitir cambiar a un nombre que ya existe
      const existing = await this.partidoRepository.findOne({
        where: { nombre: data.nombre, election: { id: partido.election.id } }
      });
      if (existing) {
        throw new ConflictException(`Ya existe una organización política con el nombre "${data.nombre}" en esta elección.`);
      }
      partido.nombre = data.nombre;
    }
    
    if (data.siglas) partido.siglas = data.siglas;
    
    // Si se subió un nuevo logo y el partido ya tenía uno viejo, borramos el viejo de la nube
    if (data.logoUrl !== undefined) {
      if (partido.logo_url && partido.logo_url !== data.logoUrl) {
        await this.deleteCloudinaryImage(partido.logo_url);
      }
      partido.logo_url = data.logoUrl;
    }

    return this.partidoRepository.save(partido);
  }

  async remove(id: string) {
    const partido = await this.partidoRepository.findOneBy({ id });
    if (!partido) throw new NotFoundException('Partido no encontrado');
    
    // Si queremos ahorrar espacio, borramos la imagen cuando eliminan el partido.
    // Al usar eliminación física (remove), los datos ya no pueden ser recuperados.
    if (partido.logo_url) {
      await this.deleteCloudinaryImage(partido.logo_url);
    }
    
    try {
      return await this.partidoRepository.remove(partido);
    } catch (error: any) {
      if (error.code === '23503' || error.errno === 1451 || error.code === 'SQLITE_CONSTRAINT') {
        throw new ConflictException('No se puede eliminar la organización política porque tiene candidatos inscritos o datos asociados.');
      }
      throw error;
    }
  }

  async reorder(updates: { id: string; orden: number }[]) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const update of updates) {
        await queryRunner.manager.update(Partido, update.id, { orden: update.orden });
      }
      await queryRunner.commitTransaction();
      return { message: 'Orden actualizado correctamente' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw new BadRequestException('Error al actualizar el orden de los partidos');
    } finally {
      await queryRunner.release();
    }
  }
}
