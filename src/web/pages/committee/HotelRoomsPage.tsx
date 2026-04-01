import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@web/lib/api'
import type { HotelRoom, Hotel } from '@shared/types'

interface HotelRoomWithHotel extends HotelRoom {
  hotelName?: string
}

export default function HotelRoomsPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: rooms = [], isLoading } = useQuery<HotelRoomWithHotel[]>({
    queryKey: ['hotel-rooms'],
    queryFn: () => api.get('/api/v1/hotel-rooms'),
  })

  const { data: hotels = [] } = useQuery<Hotel[]>({
    queryKey: ['hotels'],
    queryFn: () => api.get('/api/v1/hotels'),
  })

  const [hotelId, setHotelId] = useState('')
  const [roomType, setRoomType] = useState('')
  const [costPerNight, setCostPerNight] = useState(0)
  const [dinnerCost, setDinnerCost] = useState(0)
  const [reservedRooms, setReservedRooms] = useState(0)
  const [editingId, setEditingId] = useState<string | null>(null)

  const addMutation = useMutation({
    mutationFn: (data: Omit<HotelRoom, 'id'>) => api.post('/api/v1/hotel-rooms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-rooms'] })
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<HotelRoom> & { id: string }) =>
      api.patch(`/api/v1/hotel-rooms/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotel-rooms'] })
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/hotel-rooms/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['hotel-rooms'] }),
  })

  const resetForm = () => {
    setHotelId('')
    setRoomType('')
    setCostPerNight(0)
    setDinnerCost(0)
    setReservedRooms(0)
    setEditingId(null)
  }

  const startEdit = (room: HotelRoomWithHotel) => {
    setEditingId(room.id)
    setHotelId(room.hotelId)
    setRoomType(room.roomType)
    setCostPerNight(room.costPerNight)
    setDinnerCost(room.dinnerCost)
    setReservedRooms(room.reservedRooms)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!hotelId || !roomType.trim()) return
    const data = { hotelId, roomType: roomType.trim(), costPerNight, dinnerCost, reservedRooms }
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...data })
    } else {
      addMutation.mutate(data)
    }
  }

  const hotelName = (hid: string) => hotels.find((h) => h.id === hid)?.name ?? hid

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-400 text-sm">
        {t('common.loading')}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <h1 className="text-lg font-bold mb-6">{t('admin.hotelRooms')}</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('logistics.hotel')}</label>
            <select
              value={hotelId}
              onChange={(e) => setHotelId(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            >
              <option value="">--</option>
              {hotels.map((h) => (
                <option key={h.id} value={h.id}>{h.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.roomType')}</label>
            <input
              type="text"
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
              placeholder="Single"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.costPerNight')}</label>
            <input
              type="number"
              value={costPerNight}
              onChange={(e) => setCostPerNight(Number(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.dinnerCost')}</label>
            <input
              type="number"
              value={dinnerCost}
              onChange={(e) => setDinnerCost(Number(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.reservedRooms')}</label>
            <input
              type="number"
              value={reservedRooms}
              onChange={(e) => setReservedRooms(Number(e.target.value))}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            type="submit"
            disabled={addMutation.isPending || updateMutation.isPending}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-800 disabled:opacity-50"
          >
            {editingId ? t('common.save') : t('common.add')}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs text-gray-500">
              <th className="px-3 py-2 text-left font-medium">{t('logistics.hotel')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('admin.roomType')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('admin.costPerNight')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('admin.dinnerCost')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('admin.reservedRooms')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.id} className="border-b hover:bg-gray-50">
                <td className="px-3 py-2">{room.hotelName ?? hotelName(room.hotelId)}</td>
                <td className="px-3 py-2">{room.roomType}</td>
                <td className="px-3 py-2 text-right font-mono">{room.costPerNight}</td>
                <td className="px-3 py-2 text-right font-mono">{room.dinnerCost}</td>
                <td className="px-3 py-2 text-right font-mono">{room.reservedRooms}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    onClick={() => startEdit(room)}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(room.id)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    {t('common.delete')}
                  </button>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-400 text-xs">
                  {t('common.none')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
