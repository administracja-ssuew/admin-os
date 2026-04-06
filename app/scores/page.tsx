// Auth guard moved to client component (ScoresClientPage) to avoid RLS
// issues with the server-side anon key when reading the users table.
import ScoresClientPage from './ScoresClientPage'

export default function ScoresPage() {
  return <ScoresClientPage />
}
