import { Injectable, NotFoundException } from '@nestjs/common';
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
    const partido = await this.partidoRepository.findOneBy({ id });
    if (!partido) throw new NotFoundException('Partido no encontrado');

    if (data.nombre) partido.nombre = data.nombre;
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
    // OJO: Como usamos "softRemove", si luego quisieras restaurar el partido de la papelera,
    // revivirá pero su imagen ya estará borrada en Cloudinary.
    if (partido.logo_url) {
      await this.deleteCloudinaryImage(partido.logo_url);
    }
    
    return this.partidoRepository.softRemove(partido);
  }
}
