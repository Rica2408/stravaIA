import { Router } from 'express'

import { prisma } from '@/lib/prisma.js'

import { authMiddleware } from '@/middleware/auth.middleware.js'

import {

  getAthleteStats,

  getAuthenticatedAthlete,

  getValidStravaAccessTokenForUser,

  type StravaStats,

} from '@/services/strava.service.js'



export const meRouter = Router()

meRouter.use(authMiddleware)



function summarizeBlock(t: { count: number; distance: number; moving_time: number } | undefined) {

  if (!t) {

    return null

  }

  return {

    actividades: t.count,

    distanciaKm: Math.round((t.distance / 1000) * 10) / 10,

    tiempoMovimientoHoras: Math.round((t.moving_time / 3600) * 10) / 10,

  }

}



function pickStats(stats: StravaStats) {

  return {

    ultimas4Semanas: {

      carrera: summarizeBlock(stats.recent_run_totals),

      bici: summarizeBlock(stats.recent_ride_totals),

      natacion: summarizeBlock(stats.recent_swim_totals),

    },

    anoEnCurso: {

      carrera: summarizeBlock(stats.ytd_run_totals),

      bici: summarizeBlock(stats.ytd_ride_totals),

      natacion: summarizeBlock(stats.ytd_swim_totals),

    },

    enTotal: {

      carrera: summarizeBlock(stats.all_run_totals),

      bici: summarizeBlock(stats.all_ride_totals),

      natacion: summarizeBlock(stats.all_swim_totals),

    },

  }

}



meRouter.get('/profile', async (req, res) => {

  try {

    const userId = req.userId!

    const token = await getValidStravaAccessTokenForUser(userId)

    const athlete = await getAuthenticatedAthlete(token)



    const displayName = `${athlete.firstname} ${athlete.lastname}`.trim()

    const photo =

      athlete.profile_medium ||

      athlete.profile ||

      null



    await prisma.user.update({

      where: { id: userId },

      data: {

        displayName,

        photoUrl: photo,

        city: athlete.city ?? null,

        country: athlete.country ?? null,

      },

    })



    let statsPayload: ReturnType<typeof pickStats> | null = null

    try {

      const raw = await getAthleteStats(token, athlete.id)

      statsPayload = pickStats(raw)

    } catch {

      statsPayload = null

    }



    res.json({

      syncedAt: new Date().toISOString(),

      athlete: {

        id: athlete.id,

        username: athlete.username ?? null,

        nombre: athlete.firstname,

        apellido: athlete.lastname,

        nombreCompleto: displayName,

        ciudad: athlete.city ?? null,

        provincia: athlete.state ?? null,

        pais: athlete.country ?? null,

        sexo: athlete.sex ?? null,

        bio: athlete.bio ?? null,

        pesoKg: athlete.weight ?? null,

        unidades: athlete.measurement_preference ?? null,

        fotoUrl: photo,

        cuentaDesde: athlete.created_at ?? null,

        actualizadoEnStrava: athlete.updated_at ?? null,

      },

      estadisticas: statsPayload,

    })

  } catch (err) {

    const message = err instanceof Error ? err.message : 'Error'

    res.status(502).json({ error: `No se pudo obtener el perfil de Strava: ${message}` })

  }

})

