const fs = require('fs');

let content = fs.readFileSync('./src/actas/actas.service.ts', 'utf8');

const newMethod = `
  async findByMesa(mesaId: string) {
    const acta = await this.actaRepository.findOne({
      where: { mesa: { id: mesaId } },
      relations: ['votos', 'votos.candidato']
    });
    return acta;
  }

  async upsertManual(personeroId: string, mesaId: string, observaciones: string, votosJson: string, isPartial: boolean = false) {
    const activeElection = await this.electionRepository.findOne({ where: { activa: true } });
    if (!activeElection || activeElection.estado !== 'EN_CURSO') {
      throw new BadRequestException('La elección aún no ha iniciado o ya ha finalizado.');
    }

    const mesa = await this.mesaRepository.findOne({ where: { id: mesaId }, relations: { local: true } });
    if (!mesa) throw new BadRequestException('Mesa no encontrada');

    let existingActa = await this.actaRepository.findOne({ where: { mesa: { id: mesaId } }, relations: { votos: true } });

    let votosData: any;
    try {
      votosData = JSON.parse(votosJson);
    } catch (error) {
      throw new BadRequestException('El formato de votos es inválido');
    }

    const votosEntitiesToCreate: any[] = [];
    const sums: Record<string, number> = {
      [CargoCandidato.REGIONAL]: 0,
      [CargoCandidato.CONSEJERO]: 0,
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
        else if (parts[2] === 'consejero') nivel = CargoCandidato.CONSEJERO;
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
    const totalConsejero = sums[CargoCandidato.CONSEJERO];
    const totalProvincial = sums[CargoCandidato.PROVINCIAL];
    const totalDistrital = sums[CargoCandidato.DISTRITAL];

    const maxTotal = Math.max(totalRegional, totalConsejero, totalProvincial, totalDistrital);

    if (maxTotal === 0 && !isPartial) {
      throw new BadRequestException('Debe ingresar al menos un voto antes de guardar el acta.');
    }

    const local = mesa.local;
    if (local) {
      const safeUpper = (str?: string | null) => str ? str.trim().toUpperCase() : '';
      const lReg = safeUpper(local.region);
      const lProv = safeUpper(local.provincia);
      const lDist = safeUpper(local.distrito);

      const allElectionCandidates = await this.candidatoRepository.find({
        where: { election: { id: activeElection.id } }
      });

      const validCandidatesForMesa = allElectionCandidates.filter(c => {
        const cReg = safeUpper(c.region);
        const cProv = safeUpper(c.provincia);
        const cDist = safeUpper(c.distrito);
        
        if (c.cargo === CargoCandidato.REGIONAL) return cReg === lReg;
        if (c.cargo === CargoCandidato.CONSEJERO || c.cargo === CargoCandidato.PROVINCIAL) return cReg === lReg && cProv === lProv;
        if (c.cargo === CargoCandidato.DISTRITAL) return cReg === lReg && cProv === lProv && cDist === lDist;
        return false;
      });

      const nivelesActivos = [...new Set(validCandidatesForMesa.map(c => c.cargo))];

      for (const c of validCandidatesForMesa) {
        const existe = votosEntitiesToCreate.some(v => v.tipo === TipoVoto.CANDIDATO && v.candidato?.id === c.id);
        if (!existe) {
          votosEntitiesToCreate.push({ tipo: TipoVoto.CANDIDATO, nivel: c.cargo, candidato: c, cantidad: 0 });
        }
      }

      const tiposEspeciales = [TipoVoto.BLANCO, TipoVoto.NULO, TipoVoto.IMPUGNADO];
      for (const nivel of nivelesActivos) {
        for (const tipo of tiposEspeciales) {
          const existe = votosEntitiesToCreate.some(v => v.tipo === tipo && v.nivel === nivel);
          if (!existe) {
            votosEntitiesToCreate.push({ tipo, nivel, candidato: null, cantidad: 0 });
          }
        }
      }
    }

    if (!isPartial) {
      const hasRegionalCandidates = await this.candidatoRepository.count({ where: { cargo: CargoCandidato.REGIONAL } }) > 0;
      const hasConsejeroCandidates = await this.candidatoRepository.count({ where: { cargo: CargoCandidato.CONSEJERO } }) > 0;
      const hasProvincialCandidates = await this.candidatoRepository.count({ where: { cargo: CargoCandidato.PROVINCIAL } }) > 0;
      const hasDistritalCandidates = await this.candidatoRepository.count({ where: { cargo: CargoCandidato.DISTRITAL } }) > 0;

      if (hasRegionalCandidates && totalRegional !== maxTotal && totalRegional !== 0) {
        throw new BadRequestException("Inconsistencia: Faltan registrar votos en la sección Regional. Todos los niveles deben sumar la misma cantidad.");
      }
      if (hasConsejeroCandidates && totalConsejero !== maxTotal && totalConsejero !== 0) {
        throw new BadRequestException("Inconsistencia: Faltan registrar votos en la sección Consejero. Todos los niveles deben sumar la misma cantidad.");
      }
      if (hasProvincialCandidates && totalProvincial !== maxTotal && totalProvincial !== 0) {
        throw new BadRequestException("Inconsistencia: Faltan registrar votos en la sección Provincial. Todos los niveles deben sumar la misma cantidad.");
      }
      if (hasDistritalCandidates && totalDistrital !== maxTotal && totalDistrital !== 0) {
        throw new BadRequestException("Inconsistencia: Faltan registrar votos en la sección Distrital. Todos los niveles deben sumar la misma cantidad.");
      }

      if (mesa.cantidad_electores > 0 && maxTotal > mesa.cantidad_electores) {
        throw new BadRequestException("El número total de votos ingresados (" + maxTotal + ") es mayor a los electores hábiles de la mesa (" + mesa.cantidad_electores + ")");
      }
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let savedActa: Acta;
      
      if (existingActa) {
        existingActa.ciudadanos_votaron = maxTotal;
        existingActa.observaciones = observaciones || existingActa.observaciones;
        savedActa = await queryRunner.manager.save(existingActa);
        
        if (existingActa.votos && existingActa.votos.length > 0) {
          await queryRunner.manager.remove(existingActa.votos);
        }
      } else {
        const acta = queryRunner.manager.create(Acta, {
          mesa: { id: mesaId },
          personero: { id: personeroId },
          observaciones: observaciones || null,
          ciudadanos_votaron: maxTotal,
        });
        savedActa = await queryRunner.manager.save(acta);
      }

      if (votosEntitiesToCreate.length > 0) {
        const votosDataToSave = votosEntitiesToCreate.map(v => ({ ...v, acta: savedActa }));
        const votosEntities = queryRunner.manager.create(Voto, votosDataToSave);
        await queryRunner.manager.save(votosEntities);
      }

      if (!isPartial) {
        mesa.estado = EstadoMesa.ENVIADA;
      }
      await queryRunner.manager.save(mesa);

      await queryRunner.commitTransaction();
      return { message: 'Acta guardada correctamente', actaId: savedActa.id };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
`;

const createEndIndex = content.indexOf('async uploadFotos');
if (createEndIndex !== -1) {
  content = content.slice(0, createEndIndex) + newMethod + '\n  ' + content.slice(createEndIndex);
  fs.writeFileSync('./src/actas/actas.service.ts', content);
  console.log('patched');
} else {
  console.log('could not find uploadFotos');
}
