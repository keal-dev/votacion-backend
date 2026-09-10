import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import * as dotenv from 'dotenv';

// Cargar variables de entorno inmediatamente
dotenv.config();

// Inicializar y autenticar con Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const createStorage = (folderName: string) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
      allowedFormats: ['jpg', 'png', 'jpeg', 'webp'],
    } as any,
  });
};

const createActaStorage = (folderName: string) => {
  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
      folder: folderName,
      allowedFormats: ['jpg', 'png', 'jpeg', 'webp'],
    } as any,
  });
};

export const partidosStorage = createStorage('votacion/partidos');
export const candidatosStorage = createStorage('votacion/candidatos');
export const usersStorage = createStorage('votacion/usuarios');
export const actasStorage = createActaStorage('votacion/actas');


