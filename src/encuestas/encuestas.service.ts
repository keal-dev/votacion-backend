import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Encuesta } from './entities/encuesta.entity';
import { VotoEncuesta } from './entities/voto-encuesta.entity';
import { Candidato } from '../candidatos/entities/candidato.entity';
import { CreateEncuestaDto } from './dto/create-encuesta.dto';
import { VotarEncuestaDto } from './dto/votar-encuesta.dto';
import { Local } from '../mesas/entities/local.entity';

@Injectable()
export class EncuestasService {
  constructor(
    @InjectRepository(Encuesta)
    private readonly encuestaRepository: Repository<Encuesta>,
    @InjectRepository(VotoEncuesta)
    private readonly votoRepository: Repository<VotoEncuesta>,
    @InjectRepository(Candidato)
    private readonly candidatoRepository: Repository<Candidato>,
    @InjectRepository(Local)
    private readonly localRepository: Repository<Local>,
  ) {}

  // ================= ADMIN ENDPOINTS =================

  async create(createEncuestaDto: CreateEncuestaDto): Promise<Encuesta> {
    const existing = await this.encuestaRepository.findOne({
      where: { codigoAcceso: createEncuestaDto.codigoAcceso }
    });
    if (existing) {
      throw new BadRequestException('El código de acceso ya está en uso');
    }

    const encuesta = this.encuestaRepository.create(createEncuestaDto);
    return await this.encuestaRepository.save(encuesta);
  }

  async findAll(): Promise<Encuesta[]> {
    return await this.encuestaRepository.find({
      order: { createdAt: 'DESC' }
    });
  }

  async remove(id: string): Promise<void> {
    const encuesta = await this.encuestaRepository.findOne({ where: { id } });
    if (!encuesta) {
      throw new NotFoundException('Encuesta no encontrada');
    }
    await this.encuestaRepository.remove(encuesta);
  }

  async getResultados(id: string) {
    const encuesta = await this.encuestaRepository.findOne({
      where: { id },
      relations: { votos: { candidato: { partido: true }, local: true } }
    });

    if (!encuesta) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    // Agrupar por local
    const localesMap = new Map<string, any>();

    for (const voto of encuesta.votos) {
      const localId = voto.local ? voto.local.id : 'desconocido';
      const localNombre = voto.local ? voto.local.nombre : 'Local Desconocido';
      
      if (!localesMap.has(localId)) {
        localesMap.set(localId, {
          id: localId,
          nombre: localNombre,
          votosTotales: 0,
          candidatos: {}
        });
      }

      const localData = localesMap.get(localId);
      localData.votosTotales++;

      const candId = voto.candidato ? voto.candidato.id : 'blanco_nulo';
      const candName = voto.candidato ? `${voto.candidato.nombre} ${voto.candidato.apellidos}` : 'BLANCO / NULO';
      const partidoName = voto.candidato?.partido ? voto.candidato.partido.nombre : 'INDEPENDIENTE';
      const logoUrl = voto.candidato?.partido?.logo_url || null;
      const fotoUrl = voto.candidato?.foto_url || null;

      if (!localData.candidatos[candId]) {
        localData.candidatos[candId] = {
          id: candId,
          nombre: candName,
          partido: partidoName,
          logoUrl: logoUrl,
          fotoUrl: fotoUrl,
          votos: 0
        };
      }
      localData.candidatos[candId].votos++;
    }

    // Formatear el top 3 por local
    const resultadosPorLocal = Array.from(localesMap.values()).map(local => {
      const arrayCandidatos = Object.values(local.candidatos) as any[];
      // Ordenar por votos descendente
      arrayCandidatos.sort((a, b) => b.votos - a.votos);
      
      const top3 = arrayCandidatos.slice(0, 3).map(c => ({
        ...c,
        porcentaje: local.votosTotales > 0 ? ((c.votos / local.votosTotales) * 100).toFixed(1) : "0.0"
      }));

      const todos = arrayCandidatos.map(c => ({
        ...c,
        porcentaje: local.votosTotales > 0 ? ((c.votos / local.votosTotales) * 100).toFixed(1) : "0.0"
      }));

      return {
        id: local.id,
        nombre: local.nombre,
        votosTotales: local.votosTotales,
        top3,
        todos
      };
    });

    return {
      encuesta: {
        id: encuesta.id,
        nombre: encuesta.nombre,
        cuotaMax: encuesta.cuotaMax,
        totalVotos: encuesta.votos.length,
        activa: encuesta.activa
      },
      locales: resultadosPorLocal
    };
  }

  // ================= PUBLIC ENDPOINTS =================

  async getLocales() {
    return this.localRepository.find({
      select: { id: true, nombre: true },
      order: { nombre: 'ASC' }
    });
  }

  async validarCodigo(codigo: string) {
    const encuesta = await this.encuestaRepository.findOne({
      where: { codigoAcceso: codigo }
    });

    if (!encuesta) {
      throw new NotFoundException('Código inválido');
    }

    if (!encuesta.activa) {
      throw new BadRequestException('Esta encuesta ya está cerrada');
    }

    return {
      id: encuesta.id,
      nombre: encuesta.nombre,
      cuotaMax: encuesta.cuotaMax,
      cargo: encuesta.cargo,
      region: encuesta.region,
      provincia: encuesta.provincia,
      distrito: encuesta.distrito,
      valido: true
    };
  }

  async getProgreso(codigo: string, localId: string) {
    const encuesta = await this.encuestaRepository.findOne({
      where: { codigoAcceso: codigo },
      relations: { votos: { local: true } }
    });

    if (!encuesta) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    const votosEnLocal = encuesta.votos.filter(v => v.local && v.local.id === localId);
    return {
      cuotaMax: encuesta.cuotaMax,
      actuales: votosEnLocal.length
    };
  }

  async getCandidatosPorEncuesta(codigo: string) {
    const encuesta = await this.encuestaRepository.findOne({
      where: { codigoAcceso: codigo }
    });

    if (!encuesta) {
      throw new NotFoundException('Encuesta no encontrada');
    }

    // Filtrar candidatos según el alcance geográfico y de cargo de la encuesta
    const query = this.candidatoRepository.createQueryBuilder('candidato')
      .leftJoinAndSelect('candidato.partido', 'partido')
      .where('candidato.cargo = :cargo', { cargo: encuesta.cargo });

    if (encuesta.region) {
      query.andWhere('candidato.region = :region', { region: encuesta.region });
    }
    if (encuesta.provincia) {
      query.andWhere('candidato.provincia = :provincia', { provincia: encuesta.provincia });
    }
    if (encuesta.distrito) {
      query.andWhere('candidato.distrito = :distrito', { distrito: encuesta.distrito });
    }

    return await query.getMany();
  }

  async registrarVoto(votarDto: VotarEncuestaDto) {
    // 1. Validar la encuesta nuevamente por seguridad
    const encuesta = await this.encuestaRepository.findOne({
      where: { codigoAcceso: votarDto.codigoAcceso },
      relations: { votos: { local: true } }
    });

    if (!encuesta || !encuesta.activa) {
      throw new BadRequestException('No se puede registrar el voto. Verifique el código o el estado de la encuesta.');
    }

    // Filtrar los votos que pertenecen al local seleccionado
    const votosEnLocal = encuesta.votos.filter(v => v.local && v.local.id === votarDto.localId);
    if (votosEnLocal.length >= encuesta.cuotaMax) {
      throw new BadRequestException('Se ha alcanzado la cuota máxima de encuestas para este local de votación.');
    }

    // 2. Buscar candidato (si aplica)
    let candidato: Candidato | undefined = undefined;
    if (votarDto.candidatoId) {
      const found = await this.candidatoRepository.findOne({ where: { id: votarDto.candidatoId }});
      if (!found) {
        throw new NotFoundException('Candidato no encontrado');
      }
      candidato = found;
    }

    // 3. Guardar el voto
    const nuevoVoto = this.votoRepository.create({
      encuesta,
      candidato,
      local: { id: votarDto.localId } as any // Se asigna la relación directamente por id
    });

    await this.votoRepository.save(nuevoVoto);

    return { success: true, message: 'Voto registrado correctamente' };
  }
}
