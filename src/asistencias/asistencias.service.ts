import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Asistencia } from './entities/asistencia.entity';
import { CreateAsistenciaDto } from './dto/create-asistencia.dto';
import { User } from '../users/entities/user.entity';
import { Election } from '../elections/entities/election.entity';

@Injectable()
export class AsistenciasService {
  constructor(
    @InjectRepository(Asistencia)
    private asistenciaRepository: Repository<Asistencia>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Election)
    private electionRepository: Repository<Election>,
  ) {}

  async checkIn(userId: string, createAsistenciaDto: CreateAsistenciaDto) {
    const activeElection = await this.electionRepository.findOne({ where: { activa: true } });
    if (!activeElection || activeElection.estado !== 'EN_CURSO') {
      throw new BadRequestException('La elección aún no ha iniciado o ya ha finalizado.');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user already checked in for this election
    const existing = await this.asistenciaRepository.findOne({
      where: {
        user: { id: userId },
        election: { id: activeElection.id },
      },
    });

    if (existing) {
      throw new BadRequestException('Ya has registrado tu asistencia para esta elección');
    }

    const asistencia = this.asistenciaRepository.create({
      user,
      election: activeElection,
      latitud_llegada: createAsistenciaDto.latitud,
      longitud_llegada: createAsistenciaDto.longitud,
    });

    return this.asistenciaRepository.save(asistencia);
  }

  async checkOut(userId: string, updateDto: CreateAsistenciaDto) {
    const activeElection = await this.electionRepository.findOne({ where: { activa: true } });
    if (!activeElection) {
      throw new BadRequestException('No hay una elección activa.');
    }

    const asistencia = await this.asistenciaRepository.findOne({
      where: {
        user: { id: userId },
        election: { id: activeElection.id },
      },
    });

    if (!asistencia) {
      throw new BadRequestException('No tienes un registro de asistencia para hacer check-out');
    }

    if (asistencia.fecha_salida) {
      throw new BadRequestException('Ya has registrado tu salida para esta elección');
    }



    asistencia.latitud_salida = updateDto.latitud;
    asistencia.longitud_salida = updateDto.longitud;
    asistencia.fecha_salida = new Date();

    return this.asistenciaRepository.save(asistencia);
  }

  async getTodayStatus(userId: string) {
    const activeElection = await this.electionRepository.findOne({ where: { activa: true } });
    if (!activeElection) return null;

    const asistencia = await this.asistenciaRepository.findOne({
      where: {
        user: { id: userId },
        election: { id: activeElection.id },
      },
    });

    return asistencia || null;
  }
}
