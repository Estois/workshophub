export interface TrainingSession {
  id: number
  title: string
  description: string
  date: string
  capacity: number
  registered: number
  waitlistCount: number
  location: string
  deliveryMode: string
  status: string
  createdAt: string
  updatedAt: string
}

export interface Registration {
  id: number
  status: 'confirmed' | 'waitlisted'
  position?: number
}
