import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SystemService {
  constructor(private readonly dataSource: DataSource) { }

  async resetSystem(): Promise<{ message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Orden inverso a las dependencias (borrar primero los hijos, luego los padres)
      await queryRunner.query('DELETE FROM votos');
      await queryRunner.query('DELETE FROM actas');
      await queryRunner.query('DELETE FROM asistencias');
      await queryRunner.query('DELETE FROM mesas');
      await queryRunner.query('DELETE FROM candidatos');
      await queryRunner.query('DELETE FROM partidos');
      await queryRunner.query('DELETE FROM locales');
      await queryRunner.query('DELETE FROM elections');

      // Eliminar usuarios excepto los ADMIN
      await queryRunner.query(`DELETE FROM users WHERE role != 'ADMIN'`);

      await queryRunner.commitTransaction();

      return { message: 'Sistema restablecido correctamente. Solo se mantuvo la cuenta de Administrador.' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error al restablecer el sistema:', error);
      throw new InternalServerErrorException('Error al intentar restablecer el sistema');
    } finally {
      await queryRunner.release();
    }
  }

  async clearVotingData(): Promise<{ message: string }> {
    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Orden inverso a las dependencias
      await queryRunner.query('DELETE FROM votos');
      await queryRunner.query('DELETE FROM actas');
      await queryRunner.query('DELETE FROM asistencias');

      // Restablecer el estado de las mesas a PENDIENTE
      await queryRunner.query("UPDATE mesas SET estado = 'PENDIENTE'");

      await queryRunner.commitTransaction();

      return { message: 'Datos de votación limpiados correctamente. Se conservaron configuraciones y usuarios.' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error al limpiar datos de votación:', error);
      throw new InternalServerErrorException('Error al intentar limpiar los datos de votación');
    } finally {
      await queryRunner.release();
    }
  }

  async getDashboardMetrics() {
    try {
      const electionQuery = await this.dataSource.query('SELECT id FROM elections WHERE activa = true LIMIT 1');
      const activeElectionId = electionQuery.length > 0 ? electionQuery[0].id : null;

      const usersCount = await this.dataSource.query('SELECT COUNT(*) as count FROM users');
      const personerosCount = await this.dataSource.query(`SELECT COUNT(*) as count FROM users WHERE role = 'PERSONERO'`);
      const mesasCount = await this.dataSource.query('SELECT COUNT(*) as count FROM mesas');
      const mesasAsignadasCount = await this.dataSource.query('SELECT COUNT(*) as count FROM mesas WHERE personero_id IS NOT NULL');

      // Asistencias de la elección
      const asistenciasHoy = await this.dataSource.query(`
        SELECT COUNT(*) as count FROM asistencias
        WHERE election_id = $1
      `, [activeElectionId]);

      // Salidas de la elección
      const salidasHoy = await this.dataSource.query(`
        SELECT COUNT(*) as count FROM asistencias 
        WHERE fecha_salida IS NOT NULL AND election_id = $1
      `, [activeElectionId]);

      const actasCount = await this.dataSource.query('SELECT COUNT(*) as count FROM actas');

      // Últimas 5 asistencias
      const recentAsistencias = await this.dataSource.query(`
        SELECT a.id, a.fecha_llegada, u.name, u.lastname, u.dni
        FROM asistencias a
        JOIN users u ON a.user_id = u.id
        ORDER BY a.fecha_llegada DESC
        LIMIT 5
      `);

      // Últimas 5 actas
      const recentActas = await this.dataSource.query(`
        SELECT ac.id, ac."createdAt" as fecha, m.numero_mesa, u.name as personero_name, u.lastname as personero_lastname
        FROM actas ac
        JOIN mesas m ON ac.mesa_id = m.id
        LEFT JOIN users u ON ac.personero_id = u.id
        ORDER BY ac."createdAt" DESC
        LIMIT 5
      `);

      // --- ALERTAS ---
      // 1. Ausencias: Personeros que no han marcado asistencia (en toda la elección)
      const ausencias = await this.dataSource.query(`
        SELECT u.id, u.name, u.lastname, m.numero_mesa, l.nombre as local_nombre
        FROM users u
        JOIN mesas m ON m.personero_id = u.id
        JOIN locales l ON m.local_id = l.id
        WHERE u.role = 'PERSONERO' 
        AND NOT EXISTS (
          SELECT 1 FROM asistencias a 
          WHERE a.user_id = u.id AND a.election_id = $1
        )
        LIMIT 5
      `, [activeElectionId]);

      // 2. Retrasos: Mesas asignadas sin actas registradas
      const retrasos = await this.dataSource.query(`
        SELECT m.numero_mesa, l.nombre as local_nombre, u.name, u.lastname
        FROM mesas m
        JOIN locales l ON m.local_id = l.id
        LEFT JOIN users u ON m.personero_id = u.id
        WHERE m.personero_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM actas a WHERE a.mesa_id = m.id
        )
        LIMIT 5
      `);

      const alertas = [
        ...ausencias.map((a: any) => ({
          tipo: 'AUSENCIA',
          mensaje: `${a.name} ${a.lastname} (Mesa ${a.numero_mesa}, ${a.local_nombre}) no ha registrado llegada.`,
          tiempo: 'Crítico'
        })),
        ...retrasos.map((r: any) => ({
          tipo: 'RETRASO',
          mensaje: `Mesa ${r.numero_mesa} (${r.local_nombre}) sin actas registradas.`,
          tiempo: 'Alerta'
        }))
      ];

      // --- TIMELINE (Velocidad de escrutinio) ---
      const timelineData = await this.dataSource.query(`
        SELECT 
          EXTRACT(HOUR FROM "createdAt") as hora, 
          COUNT(*) as cantidad 
        FROM actas 
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hora ASC
      `);

      // Formatear para Recharts: { hora: '14:00', actas: 10 }
      const timeline = timelineData.map((t: any) => ({
        hora: `${String(t.hora).padStart(2, '0')}:00`,
        actas: parseInt(t.cantidad, 10)
      }));

      // --- PROGRESO DE PERSONEROS ---
      // Obtenemos todos los personeros, sus locales, si hicieron check-in hoy, y cuántas mesas han procesado vs asignadas.
      const progresoPersonerosData = await this.dataSource.query(`
        SELECT 
          u.id, u.name, u.lastname, u.dni, u.phone,
          MAX(l.nombre) as local_nombre,
          MAX(l.distrito) as local_distrito,
          MAX(l.centro_poblado) as local_centro_poblado,
          STRING_AGG(m_base.numero_mesa, ', ') as mesas_numeros,
          (SELECT COUNT(DISTINCT m.id) FROM mesas m WHERE m.personero_id = u.id) as total_mesas,
          (
            SELECT COUNT(DISTINCT a.mesa_id) 
            FROM actas a 
            JOIN mesas m2 ON a.mesa_id = m2.id 
            WHERE m2.personero_id = u.id
          ) as mesas_registradas,
          (
            SELECT a.fecha_llegada 
            FROM asistencias a 
            WHERE a.user_id = u.id AND a.election_id = $1
            LIMIT 1
          ) as check_in,
          (
            SELECT a.fecha_salida 
            FROM asistencias a 
            WHERE a.user_id = u.id AND a.election_id = $1
            LIMIT 1
          ) as check_out
        FROM users u
        LEFT JOIN mesas m_base ON m_base.personero_id = u.id
        LEFT JOIN locales l ON m_base.local_id = l.id
        WHERE u.role = 'PERSONERO'
        GROUP BY u.id, u.name, u.lastname, u.dni, u.phone
      `, [activeElectionId]);

      // Ordenar en Node: 1. Ausentes, 2. Retrasados (con check-in pero 0 actas), 3. Activos, 4. Completados
      const progresoPersoneros = progresoPersonerosData.sort((a: any, b: any) => {
        const aTotal = parseInt(a.total_mesas) || 0;
        const bTotal = parseInt(b.total_mesas) || 0;
        const aRegistradas = parseInt(a.mesas_registradas) || 0;
        const bRegistradas = parseInt(b.mesas_registradas) || 0;

        // Categoría 1: Sin check-in (Ausente)
        const aAusente = !a.check_in ? 1 : 0;
        const bAusente = !b.check_in ? 1 : 0;
        
        if (aAusente !== bAusente) return bAusente - aAusente; // Los ausentes primero (1 vs 0)

        // Categoría 2: Con check-in pero 0 avance (Retrasado)
        const aRetrasado = (a.check_in && aRegistradas === 0 && aTotal > 0) ? 1 : 0;
        const bRetrasado = (b.check_in && bRegistradas === 0 && bTotal > 0) ? 1 : 0;

        if (aRetrasado !== bRetrasado) return bRetrasado - aRetrasado; // Retrasados van después de ausentes

        // Categoría 3: Activos (Menor porcentaje primero)
        const aPorcentaje = aTotal > 0 ? (aRegistradas / aTotal) : 1;
        const bPorcentaje = bTotal > 0 ? (bRegistradas / bTotal) : 1;

        return aPorcentaje - bPorcentaje; // El de menor avance primero
      });

      return {
        totalUsers: parseInt(usersCount[0].count, 10),
        totalPersoneros: parseInt(personerosCount[0].count, 10),
        totalMesas: parseInt(mesasCount[0].count, 10),
        mesasAsignadas: parseInt(mesasAsignadasCount[0].count, 10),
        asistenciasHoy: parseInt(asistenciasHoy[0].count, 10),
        salidasHoy: parseInt(salidasHoy[0].count, 10),
        totalActas: parseInt(actasCount[0].count, 10),
        alertas,
        timeline,
        progresoPersoneros
      };
    } catch (error) {
      console.error('Error fetching dashboard metrics:', error);
      throw new InternalServerErrorException('Error al obtener métricas del dashboard');
    }
  }

  async getResultados(provincia?: string, distrito?: string, local?: string) {
    try {
      // 1. Resumen de Mesas
      let mesasTotalesQ, mesasRegistradasQ, votosData;
      const params: string[] = [];
      let whereClause = '';
      let whereActas = '';
      let whereVotos = '';

      if (local && local.trim() !== '') {
        whereClause = 'WHERE l.nombre = $1';
        whereActas = 'WHERE l.nombre = $1';
        whereVotos = "WHERE v.nivel = 'DISTRITAL' AND v.tipo = 'CANDIDATO' AND l.nombre = $1";
        params.push(local);
      } else if (distrito && distrito.trim() !== '') {
        whereClause = 'WHERE l.distrito = $1';
        whereActas = 'WHERE l.distrito = $1';
        whereVotos = "WHERE v.nivel = 'DISTRITAL' AND v.tipo = 'CANDIDATO' AND l.distrito = $1";
        params.push(distrito);
      } else if (provincia && provincia.trim() !== '') {
        whereClause = 'WHERE l.provincia = $1';
        whereActas = 'WHERE l.provincia = $1';
        whereVotos = "WHERE v.nivel = 'DISTRITAL' AND v.tipo = 'CANDIDATO' AND l.provincia = $1";
        params.push(provincia);
      } else {
        whereActas = '';
        whereVotos = "WHERE v.nivel = 'DISTRITAL' AND v.tipo = 'CANDIDATO'";
      }

      if (params.length > 0) {
        mesasTotalesQ = await this.dataSource.query(`SELECT COUNT(*) as count FROM mesas m JOIN locales l ON m.local_id = l.id ${whereClause}`, params);
        mesasRegistradasQ = await this.dataSource.query(`SELECT COUNT(DISTINCT a.mesa_id) as count FROM actas a JOIN mesas m ON a.mesa_id = m.id JOIN locales l ON m.local_id = l.id ${whereClause}`, params);
        
        votosData = await this.dataSource.query(`
          SELECT 
            v.nivel,
            v.tipo,
            SUM(v.cantidad) as total_votos,
            c.nombre as candidato_nombres,
            c.apellidos as candidato_apellidos,
            c.foto_url as candidato_foto,
            p.nombre as partido_nombre,
            p.logo_url as partido_logo
          FROM votos v
          JOIN actas a ON v.acta_id = a.id
          JOIN mesas m ON a.mesa_id = m.id
          JOIN locales l ON m.local_id = l.id
          LEFT JOIN candidatos c ON v.candidato_id = c.id
          LEFT JOIN partidos p ON c.partido_id = p.id
          ${whereClause}
          GROUP BY v.nivel, v.tipo, c.id, c.foto_url, p.id, p.logo_url
          ORDER BY total_votos DESC
        `, params);
      } else {
        mesasTotalesQ = await this.dataSource.query('SELECT COUNT(*) as count FROM mesas');
        mesasRegistradasQ = await this.dataSource.query('SELECT COUNT(DISTINCT mesa_id) as count FROM actas');
        
        votosData = await this.dataSource.query(`
          SELECT 
            v.nivel,
            v.tipo,
            SUM(v.cantidad) as total_votos,
            c.nombre as candidato_nombres,
            c.apellidos as candidato_apellidos,
            c.foto_url as candidato_foto,
            p.nombre as partido_nombre,
            p.logo_url as partido_logo
          FROM votos v
          LEFT JOIN candidatos c ON v.candidato_id = c.id
          LEFT JOIN partidos p ON c.partido_id = p.id
          GROUP BY v.nivel, v.tipo, c.id, c.foto_url, p.id, p.logo_url
          ORDER BY total_votos DESC
        `);
      }

      const mesasTotales = parseInt(mesasTotalesQ[0].count, 10);
      const mesasRegistradas = parseInt(mesasRegistradasQ[0].count, 10);
      const mesasPendientes = mesasTotales - mesasRegistradas;
      const avanceGeneral = mesasTotales > 0 ? (mesasRegistradas / mesasTotales) * 100 : 0;

      // 3. Mapa de Avance por Distrito (Termómetro)
      const distritosParams: string[] = [];
      let distritosWhere = '';
      if (provincia && provincia.trim() !== '') {
        distritosWhere = 'WHERE l.provincia = $1';
        distritosParams.push(provincia);
      }

      let distritosData;
      if (distritosParams.length > 0) {
        distritosData = await this.dataSource.query(`
          SELECT 
            l.distrito, 
            COUNT(DISTINCT m.id) as total_mesas,
            COUNT(DISTINCT a.mesa_id) as mesas_registradas
          FROM locales l
          JOIN mesas m ON m.local_id = l.id
          LEFT JOIN actas a ON a.mesa_id = m.id
          ${distritosWhere}
          GROUP BY l.distrito
          ORDER BY l.distrito ASC
        `, distritosParams);
      } else {
        distritosData = await this.dataSource.query(`
          SELECT 
            l.distrito, 
            COUNT(DISTINCT m.id) as total_mesas,
            COUNT(DISTINCT a.mesa_id) as mesas_registradas
          FROM locales l
          JOIN mesas m ON m.local_id = l.id
          LEFT JOIN actas a ON a.mesa_id = m.id
          GROUP BY l.distrito
          ORDER BY l.distrito ASC
        `);
      }

      // 4. Velocidad de escrutinio (Timeline)
      let timelineData;
      if (params.length > 0) {
        timelineData = await this.dataSource.query(`
          SELECT 
            EXTRACT(HOUR FROM a."createdAt") as hora, 
            COUNT(*) as cantidad 
          FROM actas a
          JOIN mesas m ON a.mesa_id = m.id
          JOIN locales l ON m.local_id = l.id
          ${whereActas}
          GROUP BY EXTRACT(HOUR FROM a."createdAt")
          ORDER BY hora ASC
        `, params);
      } else {
        timelineData = await this.dataSource.query(`
          SELECT 
            EXTRACT(HOUR FROM "createdAt") as hora, 
            COUNT(*) as cantidad 
          FROM actas 
          ${whereActas}
          GROUP BY EXTRACT(HOUR FROM "createdAt")
          ORDER BY hora ASC
        `);
      }

      const timeline = timelineData.map((t: any) => ({
        hora: `${String(t.hora).padStart(2, '0')}:00`,
        actas: parseInt(t.cantidad, 10)
      }));

      // 5. Proyección de Distritos Ganados
      let distritosGanadosData;
      if (params.length > 0) {
        distritosGanadosData = await this.dataSource.query(`
          SELECT 
            l.distrito,
            p.nombre as partido_nombre,
            p.logo_url as partido_logo,
            SUM(v.cantidad) as total_votos
          FROM votos v
          JOIN actas a ON v.acta_id = a.id
          JOIN mesas m ON a.mesa_id = m.id
          JOIN locales l ON m.local_id = l.id
          JOIN candidatos c ON v.candidato_id = c.id
          JOIN partidos p ON c.partido_id = p.id
          ${whereVotos}
          GROUP BY l.distrito, p.id, p.nombre, p.logo_url
        `, params);
      } else {
        distritosGanadosData = await this.dataSource.query(`
          SELECT 
            l.distrito,
            p.nombre as partido_nombre,
            p.logo_url as partido_logo,
            SUM(v.cantidad) as total_votos
          FROM votos v
          JOIN actas a ON v.acta_id = a.id
          JOIN mesas m ON a.mesa_id = m.id
          JOIN locales l ON m.local_id = l.id
          JOIN candidatos c ON v.candidato_id = c.id
          JOIN partidos p ON c.partido_id = p.id
          ${whereVotos}
          GROUP BY l.distrito, p.id, p.nombre, p.logo_url
        `);
      }

      // Procesar para encontrar el ganador por cada distrito
      const ganadoresMap = new Map();
      distritosGanadosData.forEach((row: any) => {
        const votos = parseInt(row.total_votos, 10);
        if (!ganadoresMap.has(row.distrito)) {
          ganadoresMap.set(row.distrito, { ...row, total_votos: votos });
        } else {
          const current = ganadoresMap.get(row.distrito);
          if (votos > current.total_votos) {
            ganadoresMap.set(row.distrito, { ...row, total_votos: votos });
          }
        }
      });

      const distritosGanadosResult: Record<string, any> = {};
      Array.from(ganadoresMap.values()).forEach((ganador: any) => {
        const partido = ganador.partido_nombre;
        if (!distritosGanadosResult[partido]) {
          distritosGanadosResult[partido] = {
            partido_nombre: partido,
            partido_logo: ganador.partido_logo,
            distritos_ganados: 0,
            nombres_distritos: []
          };
        }
        distritosGanadosResult[partido].distritos_ganados += 1;
        distritosGanadosResult[partido].nombres_distritos.push(ganador.distrito);
      });

      const distritosGanados = Object.values(distritosGanadosResult).sort((a: any, b: any) => b.distritos_ganados - a.distritos_ganados);

      // 6. Obtener lista de locales disponibles para el filtro (solo si hay distrito seleccionado)
      let localesLista = [];
      if (distrito && distrito.trim() !== '') {
        const localesQuery = await this.dataSource.query(`
          SELECT DISTINCT nombre, centro_poblado FROM locales WHERE distrito = $1 ORDER BY nombre ASC
        `, [distrito]);
        localesLista = localesQuery.map((l: any) => ({
          nombre: l.nombre,
          label: l.centro_poblado ? `${l.centro_poblado} - ${l.nombre}` : l.nombre
        }));
      }

      const provinciasQuery = await this.dataSource.query(`
        SELECT DISTINCT provincia FROM locales WHERE provincia IS NOT NULL AND provincia != '' ORDER BY provincia ASC
      `);
      const provinciasLista = provinciasQuery.map((p: any) => p.provincia);

      return {
        resumen: {
          mesasTotales,
          mesasRegistradas,
          mesasPendientes,
          avanceGeneral
        },
        votos: votosData,
        distritos: distritosData,
        timeline,
        distritosGanados,
        localesLista,
        provinciasLista
      };
    } catch (error) {
      console.error('Error fetching resultados:', error);
      throw new InternalServerErrorException('Error al calcular los resultados globales');
    }
  }
}
