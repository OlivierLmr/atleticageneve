import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '@web/lib/api'
import { useAuth } from '@web/lib/auth'
import type { AthleteDetail, NegotiationStatus, EapCity } from '@shared/types'
import type { HotelWithRooms, StaffUser, AgreementFormDraft } from './types'

export function useAthleteData(id: string | undefined) {
  const { data: athlete, isLoading } = useQuery<AthleteDetail>({
    queryKey: ['athlete', id],
    queryFn: () => api.get(`/api/v1/athletes/${id}`),
    enabled: !!id,
  })

  const { data: hotels = [] } = useQuery<HotelWithRooms[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/api/v1/hotels'),
  })

  const { data: staffUsers = [] } = useQuery<StaffUser[]>({
    queryKey: ['staff-users'],
    queryFn: () => api.get('/api/v1/users?role=collaborator,committee'),
  })

  const { data: eapCities = [] } = useQuery<EapCity[]>({
    queryKey: ['eap-cities'],
    queryFn: () => api.get('/api/v1/eap-cities'),
  })

  const allRooms = hotels.flatMap(h => h.rooms.map(r => ({ ...r, hotelName: h.name })))

  return { athlete, isLoading, hotels, staffUsers, allRooms, eapCities }
}

export function useAthleteMutations(id: string | undefined) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { user } = useAuth()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['athlete', id] })

  const statusMutation = useMutation({
    mutationFn: (status: NegotiationStatus) =>
      api.patch<{ emailPreview?: { subject: string; body: string; htmlBody?: string } }>(`/api/v1/athletes/${id}/negotiation-status`, { status }),
    onSuccess: invalidate,
  })

  const agreementMutation = useMutation({
    mutationFn: (data: AgreementFormDraft) =>
      api.post<{ emailPreview?: { subject: string; body: string; htmlBody?: string } }>(`/api/v1/athletes/${id}/agreements`, {
        ...data,
        appearanceFee: data.appearanceFee === '' ? 0 : data.appearanceFee,
        otherCompensation: data.otherCompensation === '' ? 0 : data.otherCompensation,
        transport: data.transport === '' ? 0 : data.transport,
        hotelRoomId: data.hotelRoomId || undefined,
      }),
    onSuccess: invalidate,
  })

  const noteMutation = useMutation({
    mutationFn: (data: { type: string; content: string }) =>
      api.post(`/api/v1/athletes/${id}/interactions`, data),
    onSuccess: invalidate,
  })

  const internalNotesMutation = useMutation({
    mutationFn: (notes: string) =>
      api.patch(`/api/v1/athletes/${id}`, { internalNotes: notes }),
    onSuccess: invalidate,
  })

  const participationMutation = useMutation({
    mutationFn: ({ appId, status }: { appId: string; status: string }) =>
      api.patch(`/api/v1/applications/${appId}/participation-status`, { participationStatus: status }),
    onSuccess: invalidate,
  })

  const scoreMutation = useMutation({
    mutationFn: (appId: string) => api.post(`/api/v1/applications/${appId}/score`, {}),
    onSuccess: invalidate,
  })

  const athleteUpdateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch(`/api/v1/athletes/${id}`, data),
    onSuccess: invalidate,
  })

  const waPerfMutation = useMutation({
    mutationFn: (data: { athleteId: string; eventId: string; personalBest?: number; seasonBest?: number; worldRanking?: number }) =>
      api.post('/api/v1/wa-performance', data),
    onSuccess: invalidate,
  })

  const waFetchMutation = useMutation({
    mutationFn: () => api.post<{ fetched: number; matched: number; errors: string[] }>(`/api/v1/wa-performance/fetch/${id}`),
    onSuccess: invalidate,
  })

  const counterOfferMutation = useMutation({
    mutationFn: async (text: string) => {
      await api.post(`/api/v1/athletes/${id}/interactions`, { type: 'counter_offer', content: text })
      return api.patch<{ emailPreview?: { subject: string; body: string; htmlBody?: string } }>(`/api/v1/athletes/${id}/negotiation-status`, { status: 'counter_offer_sent' })
    },
    onSuccess: invalidate,
  })

  const freeMessageMutation = useMutation({
    mutationFn: (text: string) =>
      api.post(`/api/v1/athletes/${id}/interactions`, { type: 'note', content: text }),
    onSuccess: invalidate,
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.delete(`/api/v1/athletes/${id}`),
    onSuccess: () => navigate(
      user?.role === 'committee' ? '/committee/candidates' :
      user?.role === 'manager' ? '/manager/portal' :
      user?.role === 'athlete' ? '/athlete/portal' :
      '/collaborator/candidates'
    ),
  })

  return {
    statusMutation,
    agreementMutation,
    noteMutation,
    internalNotesMutation,
    participationMutation,
    scoreMutation,
    athleteUpdateMutation,
    waPerfMutation,
    waFetchMutation,
    counterOfferMutation,
    freeMessageMutation,
    archiveMutation,
  }
}

export function useEmailQuery(emailId: string | null) {
  return useQuery<{ subject: string; body: string; htmlBody?: string; to: string; sentAt: string }>({
    queryKey: ['email', emailId],
    queryFn: () => api.get(`/api/v1/emails/${emailId}`),
    enabled: !!emailId,
  })
}
