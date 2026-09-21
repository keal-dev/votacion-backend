import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Election } from '../elections/entities/election.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Election)
    private readonly electionRepository: Repository<Election>,
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
}
