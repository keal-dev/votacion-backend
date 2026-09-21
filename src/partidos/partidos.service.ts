import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Partido } from './entities/partido.entity';
import { Election } from '../elections/entities/election.entity';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class PartidosService {
  constructor(
    @InjectRepository(Partido)
    private readonly partidoRepository: Repository<Partido>,
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
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

  async findByElection(electionId: string) {
    return this.partidoRepository.find({
      where: { election: { id: electionId } },
      order: { nombre: 'ASC' }
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
}
