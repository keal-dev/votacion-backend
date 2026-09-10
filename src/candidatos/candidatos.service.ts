import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets, IsNull } from 'typeorm';
import { Candidato } from './entities/candidato.entity';
import { Mesa } from '../mesas/entities/mesa.entity';
import { Partido } from '../partidos/entities/partido.entity';
import { Election } from '../elections/entities/election.entity';
import { v2 as cloudinary } from 'cloudinary';
import { CargoCandidato } from './enums/cargo.enum';

@Injectable()
export class CandidatosService {
  constructor(
    @InjectRepository(Candidato)
    private readonly candidatoRepository: Repository<Candidato>,
    @InjectRepository(Partido)
    private readonly partidoRepository: Repository<Partido>,
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
    @InjectRepository(Mesa)
    private readonly mesaRepository: Repository<Mesa>,
  ) { }

  private async deleteCloudinaryImage(url: string) {
    if (!url || !url.includes('cloudinary.com')) return;
    try {
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

  async create(data: {
    nombre: string;
    apellidos: string;
    dni: string;
    cargo: CargoCandidato;
    region?: string;
    provincia?: string;
    distrito?: string;
    fotoUrl: string | null;
    partidoId: string;
    electionId: string;
  }) {
    const election = await this.electionRepository.findOneBy({ id: data.electionId });
    if (!election) throw new NotFoundException('Elección no encontrada');

    const partido = await this.partidoRepository.findOneBy({ id: data.partidoId });
    if (!partido) throw new NotFoundException('Partido no encontrado');

    const existingCandidato = await this.candidatoRepository.findOne({
      where: {
        election: { id: data.electionId },
        partido: { id: data.partidoId },
        cargo: data.cargo,
        region: data.region || IsNull(),
        provincia: data.provincia || IsNull(),
        distrito: data.distrito || IsNull(),
      },
    });

    if (existingCandidato) {
      throw new BadRequestException('El partido ya tiene un candidato registrado para este cargo y ubicación.');
    }

    const candidato = this.candidatoRepository.create({
      nombre: data.nombre,
      apellidos: data.apellidos,
      dni: data.dni,
      cargo: data.cargo,
      region: data.region || null,
      provincia: data.provincia || null,
      distrito: data.distrito || null,
      foto_url: data.fotoUrl || null,
      partido,
      election,
    });

    return this.candidatoRepository.save(candidato);
  }

  async findByElection(electionId: string) {
    return this.candidatoRepository.find({
      where: { election: { id: electionId } },
      relations: { partido: true },
      order: { cargo: 'ASC', nombre: 'ASC' }
    });
  }

  async findByMesa(mesaId: string) {
    const mesa = await this.mesaRepository.findOne({
      where: { id: mesaId },
      relations: { local: true, election: true }
    });

    if (!mesa) throw new NotFoundException('Mesa no encontrada');

    const local = mesa.local;
    if (!local) throw new NotFoundException('La mesa no tiene un local asignado');

    return this.candidatoRepository.createQueryBuilder('candidato')
      .leftJoinAndSelect('candidato.partido', 'partido')
      .where('candidato.election_id = :electionId', { electionId: mesa.election.id })
      .andWhere(
        new Brackets((qb) => {
          qb.where('candidato.cargo = :cargoRegional AND candidato.region = :region', {
            cargoRegional: CargoCandidato.REGIONAL,
            region: local.region,
          })
          .orWhere('candidato.cargo = :cargoProvincial AND candidato.region = :region AND candidato.provincia = :provincia', {
            cargoProvincial: CargoCandidato.PROVINCIAL,
            region: local.region,
            provincia: local.provincia,
          })
          .orWhere('candidato.cargo = :cargoDistrital AND candidato.region = :region AND candidato.provincia = :provincia AND candidato.distrito = :distrito', {
            cargoDistrital: CargoCandidato.DISTRITAL,
            region: local.region,
            provincia: local.provincia,
            distrito: local.distrito,
          });
        })
      )
      .orderBy('candidato.cargo', 'ASC')
      .addOrderBy('partido.nombre', 'ASC')
      .getMany();
  }

  async update(id: string, data: any) {
    const candidato = await this.candidatoRepository.findOne({ 
      where: { id },
      relations: { partido: true, election: true }
    });
    if (!candidato) throw new NotFoundException('Candidato no encontrado');

    const targetCargo = data.cargo || candidato.cargo;
    const targetRegion = data.region !== undefined ? (data.region || null) : candidato.region;
    const targetProvincia = data.provincia !== undefined ? (data.provincia || null) : candidato.provincia;
    const targetDistrito = data.distrito !== undefined ? (data.distrito || null) : candidato.distrito;
    const targetPartidoId = data.partidoId || candidato.partido.id;

    const existingCandidato = await this.candidatoRepository.findOne({
      where: {
        election: { id: candidato.election.id },
        partido: { id: targetPartidoId },
        cargo: targetCargo,
        region: targetRegion || IsNull(),
        provincia: targetProvincia || IsNull(),
        distrito: targetDistrito || IsNull(),
      },
    });

    if (existingCandidato && existingCandidato.id !== id) {
      throw new BadRequestException('El partido ya tiene un candidato registrado para este cargo y ubicación.');
    }

    if (data.nombre) candidato.nombre = data.nombre;
    if (data.apellidos) candidato.apellidos = data.apellidos;
    if (data.dni) candidato.dni = data.dni;
    if (data.cargo) candidato.cargo = data.cargo;

    if (data.partidoId) {
      const partido = await this.partidoRepository.findOneBy({ id: data.partidoId });
      if (!partido) throw new NotFoundException('Partido no encontrado');
      candidato.partido = partido;
    }

    // Permitir nulos explícitos si se actualiza el cargo y se limpian
    if (data.region !== undefined) candidato.region = data.region || null;
    if (data.provincia !== undefined) candidato.provincia = data.provincia || null;
    if (data.distrito !== undefined) candidato.distrito = data.distrito || null;

    if (data.fotoUrl !== undefined) {
      if (candidato.foto_url && candidato.foto_url !== data.fotoUrl) {
        await this.deleteCloudinaryImage(candidato.foto_url);
      }
      candidato.foto_url = data.fotoUrl || null;
    }

    return this.candidatoRepository.save(candidato);
  }

  async remove(id: string) {
    const candidato = await this.candidatoRepository.findOneBy({ id });
    if (!candidato) throw new NotFoundException('Candidato no encontrado');

    if (candidato.foto_url) {
      await this.deleteCloudinaryImage(candidato.foto_url);
    }

    return this.candidatoRepository.softRemove(candidato);
  }
}
