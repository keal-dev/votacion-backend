import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Election } from '../elections/entities/election.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { v2 as cloudinary } from 'cloudinary';
import { DataSource } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { Role } from '../auth/enums/role.enum';
import * as streamifier from 'streamifier';
const csv = require('csv-parser');

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
    private readonly dataSource: DataSource,
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

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ relations: { election: true } });
  }

  async findByElection(electionId: string): Promise<User[]> {
    return this.usersRepository.find({
      where: { election: { id: electionId } },
      relations: { election: true }
    });
  }

  async findOne(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id }, relations: { election: true } });
  }

  async findByDni(dni: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { dni }, relations: { election: true } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phone } });
  }

  async create(createUserDto: CreateUserDto, imageUrl?: string): Promise<User> {
    // Check DNI
    const existing = await this.findByDni(createUserDto.dni);
    if (existing) {
      if (imageUrl) await this.deleteCloudinaryImage(imageUrl);
      throw new ConflictException('Ya existe un usuario con este DNI');
    }

    // Check Phone uniqueness if provided
    if (createUserDto.phone && createUserDto.phone.trim() !== '') {
      const existingPhone = await this.findByPhone(createUserDto.phone);
      if (existingPhone) {
        if (imageUrl) await this.deleteCloudinaryImage(imageUrl);
        throw new ConflictException('Ya existe un usuario con este teléfono');
      }
    }

    let election: Election | null = null;
    if (createUserDto.electionId) {
      election = await this.electionRepository.findOneBy({ id: createUserDto.electionId });
      if (!election) {
        if (imageUrl) await this.deleteCloudinaryImage(imageUrl);
        throw new NotFoundException('Elección no encontrada');
      }
    }

    const user = this.usersRepository.create({
      name: createUserDto.name,
      lastname: createUserDto.lastname,
      dni: createUserDto.dni,
      phone: createUserDto.phone,
      role: createUserDto.role,
      password: createUserDto.dni, // Plain text password as requested
      image: imageUrl ?? null,
      election: election ?? undefined,
    });

    return this.usersRepository.save(user);
  }

  async updatePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    user.password = newPassword;
    await this.usersRepository.save(user);
  }

  async update(id: string, updateUserDto: UpdateUserDto, imageUrl?: string): Promise<User> {
    const user = await this.findOne(id);
    if (!user) {
      if (imageUrl) await this.deleteCloudinaryImage(imageUrl);
      throw new NotFoundException('Usuario no encontrado');
    }

    if (updateUserDto.dni && updateUserDto.dni !== user.dni) {
      const existing = await this.findByDni(updateUserDto.dni);
      if (existing) {
        if (imageUrl) await this.deleteCloudinaryImage(imageUrl);
        throw new ConflictException('Ya existe un usuario con este DNI');
      }
      user.dni = updateUserDto.dni;
      user.password = updateUserDto.dni; // Update plain password to new DNI as requested
    }

    if (updateUserDto.name) user.name = updateUserDto.name;
    if (updateUserDto.lastname) user.lastname = updateUserDto.lastname;
    
    // Check Phone uniqueness if provided and changed
    if (updateUserDto.phone !== undefined && updateUserDto.phone !== user.phone) {
      if (updateUserDto.phone.trim() !== '') {
        const existingPhone = await this.findByPhone(updateUserDto.phone);
        if (existingPhone) {
          if (imageUrl) await this.deleteCloudinaryImage(imageUrl);
          throw new ConflictException('Ya existe un usuario con este teléfono');
        }
      }
      user.phone = updateUserDto.phone;
    }
    if (updateUserDto.role) user.role = updateUserDto.role;
    if (updateUserDto.password) user.password = updateUserDto.password;

    if (updateUserDto.electionId) {
      const election = await this.electionRepository.findOneBy({ id: updateUserDto.electionId });
      if (!election) {
        if (imageUrl) await this.deleteCloudinaryImage(imageUrl);
        throw new NotFoundException('Elección no encontrada');
      }
      user.election = election;
    } else if (updateUserDto.electionId === null) {
      // Clear election if explicitly set to null
      user.election = null;
    }

    if (imageUrl !== undefined) {
      if (user.image && user.image !== imageUrl) {
        await this.deleteCloudinaryImage(user.image);
      }
      user.image = imageUrl || null;
    }

    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.image) {
      await this.deleteCloudinaryImage(user.image);
    }
    await this.usersRepository.remove(user);
  }

  async createManyFromCsv(electionId: string, fileBuffer: Buffer): Promise<any> {
    const election = await this.electionRepository.findOneBy({ id: electionId });
    if (!election) throw new NotFoundException('Elección no encontrada');

    const results: any[] = [];

    // Parse CSV
    await new Promise((resolve, reject) => {
      streamifier.createReadStream(fileBuffer)
        .pipe(csv({
          separator: ';',
          mapHeaders: ({ header }) => header.trim().replace(/^[\uFEFF\u200B]/g, '').toLowerCase()
        }))
        .on('data', (data: any) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      throw new BadRequestException('El archivo CSV/Excel está vacío o no tiene el formato correcto.');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingDnisInDb = await queryRunner.manager.find(User, { select: { dni: true } });
      const dbDnisSet = new Set(existingDnisInDb.map(u => u.dni));
      
      const existingPhonesInDb = await queryRunner.manager.find(User, { select: { phone: true } });
      const dbPhonesSet = new Set(existingPhonesInDb.filter(u => u.phone).map(u => u.phone));

      const currentCsvDnisSet = new Set<string>();
      const currentCsvPhonesSet = new Set<string>();

      for (let i = 0; i < results.length; i++) {
        const row = results[i];
        const rowNumber = i + 2;

        const name = row['nombres']?.trim();
        const lastname = row['apellidos']?.trim();
        const dni = row['dni']?.trim();
        const phone = row['telefono']?.trim() || null;
        let roleRaw = row['rol']?.trim()?.toUpperCase();

        if (!name) throw new BadRequestException(`Fila ${rowNumber}: NOMBRES es obligatorio.`);
        if (!lastname) throw new BadRequestException(`Fila ${rowNumber}: APELLIDOS es obligatorio.`);
        if (!dni) throw new BadRequestException(`Fila ${rowNumber}: DNI es obligatorio.`);
        if (!roleRaw) throw new BadRequestException(`Fila ${rowNumber}: ROL es obligatorio.`);

        // Validate Role
        if (roleRaw !== Role.PERSONERO && roleRaw !== Role.COORDINADOR && roleRaw !== Role.ADMIN) {
          throw new BadRequestException(`Fila ${rowNumber}: ROL inválido ("${roleRaw}"). Debe ser PERSONERO, COORDINADOR o ADMIN.`);
        }

        // Validate DNI duplication
        if (dbDnisSet.has(dni)) {
          throw new BadRequestException(`Fila ${rowNumber}: El DNI "${dni}" ya está registrado en el sistema.`);
        }
        if (currentCsvDnisSet.has(dni)) {
          throw new BadRequestException(`Fila ${rowNumber}: El DNI "${dni}" está repetido dentro del mismo archivo Excel.`);
        }
        currentCsvDnisSet.add(dni);

        // Validate Phone duplication
        if (phone) {
          if (dbPhonesSet.has(phone)) {
            throw new BadRequestException(`Fila ${rowNumber}: El TELÉFONO "${phone}" ya está registrado en el sistema.`);
          }
          if (currentCsvPhonesSet.has(phone)) {
            throw new BadRequestException(`Fila ${rowNumber}: El TELÉFONO "${phone}" está repetido dentro del mismo archivo Excel.`);
          }
          currentCsvPhonesSet.add(phone);
        }

        const newUser = queryRunner.manager.create(User, {
          name,
          lastname,
          dni,
          phone,
          role: roleRaw as Role,
          password: dni, // Plain password as DNI initially
          image: null,
          election
        });

        await queryRunner.manager.save(newUser);
      }

      await queryRunner.commitTransaction();
      return { message: `Se importaron ${results.length} usuarios exitosamente.` };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
