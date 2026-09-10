import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Election } from './entities/election.entity';
import { CreateElectionDto } from './dto/create-election.dto';
import { UpdateElectionDto } from './dto/update-election.dto';

@Injectable()
export class ElectionsService {
  constructor(
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
    private dataSource: DataSource,
  ) { }

  async create(createElectionDto: CreateElectionDto): Promise<Election> {
    if (createElectionDto.activa) {
      await this.deactivateAll();
    }
    const election = this.electionRepository.create(createElectionDto);
    return this.electionRepository.save(election);
  }

  findAll(): Promise<Election[]> {
    return this.electionRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Election> {
    const election = await this.electionRepository.findOneBy({ id });
    if (!election) throw new NotFoundException(`Elección con ID ${id} no encontrada`);
    return election;
  }

  async update(id: string, updateElectionDto: UpdateElectionDto): Promise<Election> {
    const election = await this.findOne(id);

    if (updateElectionDto.activa) {
      await this.deactivateAll();
    }

    Object.assign(election, updateElectionDto);
    return this.electionRepository.save(election);
  }

  async remove(id: string): Promise<void> {
    const election = await this.findOne(id);
    await this.electionRepository.softRemove(election);
  }

  // Método privado para asegurar que solo una elección esté activa a la vez
  private async deactivateAll() {
    await this.dataSource
      .createQueryBuilder()
      .update(Election)
      .set({ activa: false })
      .where("activa = :activa", { activa: true })
      .execute();
  }
}
