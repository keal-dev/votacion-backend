import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Acta } from './entities/acta.entity';
import { Voto, TipoVoto } from './entities/voto.entity';
import { Mesa, EstadoMesa } from '../mesas/entities/mesa.entity';
import { Candidato } from '../candidatos/entities/candidato.entity';
import { CargoCandidato } from '../candidatos/enums/cargo.enum';
import { Election } from '../elections/entities/election.entity';
import { FotoActa } from './entities/foto-acta.entity';
import { async } from 'rxjs';

@Injectable()
export class ActasService {
  constructor(
    @InjectRepository(Acta)
    private actaRepository: Repository<Acta>,
    @InjectRepository(Voto)
    private votoRepository: Repository<Voto>,
    @InjectRepository(Mesa)
    private mesaRepository: Repository<Mesa>,
    @InjectRepository(Candidato)
    private candidatoRepository: Repository<Candidato>,
    @InjectRepository(Election)
    private electionRepository: Repository<Election>,
    @InjectRepository(FotoActa)
    private fotoActaRepository: Repository<FotoActa>,
  ) { }

  async create(personeroId: string, mesaId: string, files: Express.Multer.File[], observaciones: string, votosJson: string) {
    const activeElection = await this.electionRepository.findOne({ where: { activa: true } });
    if (!activeElection || activeElection.estado !== 'EN_CURSO') {
      throw new BadRequestException('La elección aún no ha iniciado o ya ha finalizado.');
    }

    const mesa = await this.mesaRepository.findOne({ where: { id: mesaId } });
    if (!mesa) throw new BadRequestException('Mesa no encontrada');

    // Analizar JSON de votos
    let votosData: any;
    try {
      votosData = JSON.parse(votosJson);
    } catch (error) {
      throw new BadRequestException('El formato de votos es inválido');
    }

    // Preparar votos y calcular sumas
    const votosEntitiesToCreate: any[] = [];
    const sums = {
      [CargoCandidato.REGIONAL]: 0,
      [CargoCandidato.PROVINCIAL]: 0,
      [CargoCandidato.DISTRITAL]: 0
    };

    for (const key in votosData) {
      const parts = key.split('_');
      if (parts.length < 2) continue;

      const cantidad = parseInt(votosData[key]) || 0;

      if (parts.length === 3 && (parts[1] === 'blanco' || parts[1] === 'nulo' || parts[1] === 'impugnado')) {
        let tipo: TipoVoto;
        if (parts[1] === 'blanco') tipo = TipoVoto.BLANCO;
        else if (parts[1] === 'nulo') tipo = TipoVoto.NULO;
        else tipo = TipoVoto.IMPUGNADO;

        let nivel: CargoCandidato;
        if (parts[2] === 'distrital') nivel = CargoCandidato.DISTRITAL;
        else if (parts[2] === 'provincial') nivel = CargoCandidato.PROVINCIAL;
        else nivel = CargoCandidato.REGIONAL;

        sums[nivel] += cantidad;
        votosEntitiesToCreate.push({ tipo, nivel, candidato: null, cantidad });
      }
      else if (parts.length === 2 && parts[1].length > 10) {
        const candidatoId = parts[1];
        const candidato = await this.candidatoRepository.findOne({ where: { id: candidatoId } });

        if (candidato) {
          sums[candidato.cargo] += cantidad;
          votosEntitiesToCreate.push({
            tipo: TipoVoto.CANDIDATO,
            nivel: candidato.cargo,
            candidato: candidato,
            cantidad
          });
        }
      }
    }

    const totalRegional = sums[CargoCandidato.REGIONAL];
    const totalProvincial = sums[CargoCandidato.PROVINCIAL];
    const totalDistrital = sums[CargoCandidato.DISTRITAL];

    const maxTotal = Math.max(totalRegional, totalProvincial, totalDistrital);

    if (maxTotal === 0) {
      throw new BadRequestException('Debe ingresar al menos un voto antes de guardar el acta.');
    }

    // Verificar en la base de datos si existen candidatos para cada nivel
    const hasRegionalCandidates = await this.candidatoRepository.count({ where: { cargo: CargoCandidato.REGIONAL } }) > 0;
    const hasProvincialCandidates = await this.candidatoRepository.count({ where: { cargo: CargoCandidato.PROVINCIAL } }) > 0;
    const hasDistritalCandidates = await this.candidatoRepository.count({ where: { cargo: CargoCandidato.DISTRITAL } }) > 0;

    // Si existen candidatos para un nivel, es OBLIGATORIO que su total de votos coincida con el máximo
    if (hasRegionalCandidates && totalRegional !== maxTotal) {
      throw new BadRequestException(`Inconsistencia: Faltan registrar votos en la sección Regional. Todos los niveles deben sumar la misma cantidad.`);
    }
    if (hasProvincialCandidates && totalProvincial !== maxTotal) {
      throw new BadRequestException(`Inconsistencia: Faltan registrar votos en la sección Provincial. Todos los niveles deben sumar la misma cantidad.`);
    }
    if (hasDistritalCandidates && totalDistrital !== maxTotal) {
      throw new BadRequestException(`Inconsistencia: Faltan registrar votos en la sección Distrital. Todos los niveles deben sumar la misma cantidad.`);
    }

    const ciudadanosVotaronCalculado = maxTotal;

    // Validar cantidad de electores (techo)
    if (mesa.cantidad_electores > 0 && ciudadanosVotaronCalculado > mesa.cantidad_electores) {
      throw new BadRequestException(`El número total de votos ingresados (${ciudadanosVotaronCalculado}) es mayor a los electores hábiles de la mesa (${mesa.cantidad_electores})`);
    }

    // Si todo es válido, guardamos el acta
    const acta = this.actaRepository.create({
      mesa: { id: mesaId },
      personero: { id: personeroId },
      observaciones: observaciones || null,
      ciudadanos_votaron: ciudadanosVotaronCalculado,
    });
    const savedActa = await this.actaRepository.save(acta);

    // Guardar Fotos
    const urls = files.map(file => file.path);
    if (urls.length > 0) {
      const fotosToSave = urls.map(url => this.fotoActaRepository.create({ url, acta: savedActa }));
      await this.fotoActaRepository.save(fotosToSave);
    }

    // Guardar Votos
    if (votosEntitiesToCreate.length > 0) {
      const votosDataToSave = votosEntitiesToCreate.map(v => ({ ...v, acta: savedActa }));
      const votosEntities = this.votoRepository.create(votosDataToSave);
      await this.votoRepository.save(votosEntities);
    }

    // Actualizar estado de la mesa a ENVIADA
    mesa.estado = EstadoMesa.ENVIADA;
    await this.mesaRepository.save(mesa);

    return { message: 'Acta y votos guardados correctamente', actaId: savedActa.id };
  }

  async uploadFotos(actaId: string, files: Express.Multer.File[]) {
    const acta = await this.actaRepository.findOne({ where: { id: actaId } });
    if (!acta) {
      throw new NotFoundException('Acta no encontrada');
    }

    const urls = files.map(file => file.path);
    if (urls.length > 0) {
      const fotosToSave = urls.map(url => this.fotoActaRepository.create({ url, acta }));
      await this.fotoActaRepository.save(fotosToSave);
    }

    return { message: 'Fotos subidas correctamente' };
  }

  async findAllForAudit(page: number = 1, limit: number = 25, search?: string, estado?: string, local?: string) {
    const query = this.actaRepository.createQueryBuilder('acta')
      .leftJoinAndSelect('acta.mesa', 'mesa')
      .leftJoinAndSelect('mesa.local', 'local')
      .leftJoinAndSelect('acta.personero', 'personero')
      .leftJoinAndSelect('acta.fotos', 'fotos')
      .leftJoinAndSelect('acta.votos', 'votos')
      .leftJoinAndSelect('votos.candidato', 'candidato')
      .leftJoinAndSelect('candidato.partido', 'partido')
      .orderBy('acta.createdAt', 'DESC');

    if (estado && estado !== 'TODOS') {
      // Si el estado es PENDIENTE, también incluimos nulos ya que es el por defecto
      if (estado === 'PENDIENTE') {
        query.andWhere('(acta.estado = :estado OR acta.estado IS NULL)', { estado });
      } else {
        query.andWhere('acta.estado = :estado', { estado });
      }
    }

    if (local) {
      query.andWhere('local.id = :local', { local });
    }

    if (search) {
      query.andWhere(
        '(LOWER(mesa.numero_mesa) LIKE LOWER(:search) OR LOWER(local.nombre) LIKE LOWER(:search) OR LOWER(personero.name) LIKE LOWER(:search) OR LOWER(personero.lastname) LIKE LOWER(:search))',
        { search: `%${search}%` }
      );
    }

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    // Aggregate counts for the tabs
    const countsRaw = await this.actaRepository.createQueryBuilder('acta')
      .select('COALESCE(acta.estado, \'PENDIENTE\')', 'estado')
      .addSelect('COUNT(acta.id)', 'count')
      .groupBy('COALESCE(acta.estado, \'PENDIENTE\')')
      .getRawMany();

    const counts: any = { TODOS: 0, PENDIENTE: 0, PROCESADO: 0, AUDITADO: 0, OBSERVADO: 0, ANULADO: 0 };
    let totalAll = 0;
    
    countsRaw.forEach(row => {
      const e = row.estado;
      const c = parseInt(row.count, 10);
      counts[e] = c;
      totalAll += c;
    });
    counts.TODOS = totalAll;

    return {
      data,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      },
      counts
    };
  }

  async findOneForAudit(id: string) {
    const acta = await this.actaRepository.findOne({
      where: { id },
      relations: {
        mesa: {
          local: true
        },
        personero: true,
        fotos: true,
        votos: {
          candidato: {
            partido: true
          }
        }
      }
    });

    if (!acta) {
      throw new NotFoundException('Acta no encontrada');
    }

    return acta;
  }
  async updateEstado(id: string, estado: string) {
    const acta = await this.actaRepository.findOne({ where: { id } });
    if (!acta) {
      throw new NotFoundException('Acta no encontrada');
    }
    
    const validStates = ['PENDIENTE', 'OBSERVADO', 'AUDITADO', 'ANULADO'];
    if (!validStates.includes(estado)) {
      throw new BadRequestException('Estado inválido');
    }

    acta.estado = estado;
    await this.actaRepository.save(acta);
    return { message: 'Estado actualizado correctamente', estado };
  }


  async updateVotos(actaId: string, votosUpdates: { votoId: string, cantidad: number }[]) {
    const acta = await this.actaRepository.findOne({
      where: { id: actaId },
      relations: {
        votos: true
      }
    });

    if (!acta) {
      throw new NotFoundException('Acta no encontrada');
    }

    // Update votos
    let hasChanges = false;
    for (const update of votosUpdates) {
      const voto = acta.votos.find(v => v.id === update.votoId);
      if (voto && voto.cantidad !== update.cantidad) {
        voto.cantidad = update.cantidad;
        await this.votoRepository.save(voto);
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const updatedVotos = await this.votoRepository.find({
        where: { acta: { id: actaId }, nivel: CargoCandidato.REGIONAL }
      });
      const newTotal = updatedVotos.reduce((sum, voto) => sum + voto.cantidad, 0);

      acta.ciudadanos_votaron = newTotal;
      await this.actaRepository.save(acta);
    }

    return { message: 'Votos actualizados correctamente' };
  }
}