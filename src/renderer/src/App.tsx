import { useState } from 'react'
import Shelf from './pages/Shelf'
import Reader from './pages/Reader'

export default function App() {
  const [bookId, setBookId] = useState<string | null>(null)

  if (bookId === null) {
    return <Shelf onOpen={(id) => setBookId(id)} />
  }
  return <Reader bookId={bookId} onBack={() => setBookId(null)} />
}
