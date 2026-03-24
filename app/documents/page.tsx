'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import Sidebar from '../../components/Sidebar'
import { FileText, Plus, Search, X, Loader2, CheckCircle, AlertTriangle, Clock, MessageSquare, User } from 'lucide-react'
import toast from 'react-hot-toast' // Importujemy Toasty!

export default function DocumentsPage() {
  const [docs, setDocs] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([]) // NOWE: Lista użytkowników do przypisania
  const [loading, setLoading] = useState(true)
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('Wszystkie')

  // Stany Modala (Dodawanie)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [selectedOwnerId, setSelectedOwnerId] = useState('') // NOWE: Wybrany właściciel
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Stany Panelu Weryfikacji
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<any>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [note, setNote] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    // Pobieramy dokumenty
    const { data: docsData } = await supabase
      .from('documents')
      .select('*, profiles(full_name)') // Magia Supabase: dociągamy imię właściciela na podstawie ID!
      .order('created_at', { ascending: false })
    
    // Pobieramy użytkowników (żeby mieć listę w formularzu)
    const { data: usersData } = await supabase.from('profiles').select('*')

    if (docsData) setDocs(docsData)
    if (usersData) {
        setUsers(usersData)
        if (usersData.length > 0) setSelectedOwnerId(usersData[0].id) // Domyślnie pierwszy na liście
    }
    setLoading(false)
  }

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const toastId = toast.loading('Dodawanie dokumentu...') // Pokazujemy ładowanie w toascie

    const { error } = await supabase
      .from('documents')
      // Dodajemy owner_id do bazy!
      .insert([{ title: newDocTitle, status: 'Oczekujący', owner_id: selectedOwnerId }])

    if (!error) {
      setNewDocTitle('')
      setIsModalOpen(false)
      fetchData()
      toast.success('Dokument dodany pomyślnie!', { id: toastId }) // Sukces!
    } else {
      toast.error('Błąd: ' + error.message, { id: toastId }) // Błąd!
    }
    setIsSubmitting(false)
  }

  const openDetails = (doc: any) => {
    setSelectedDoc(doc)
    setNote(doc.notes || '') 
    setIsDrawerOpen(true)
  }

  const updateStatusAndNote = async (newStatus: string) => {
    if (!selectedDoc) return
    setIsUpdating(true)
    
    const toastId = toast.loading('Aktualizacja statusu...')

    const { error } = await supabase
      .from('documents')
      .update({ status: newStatus, notes: note })
      .eq('id', selectedDoc.id)

    if (!error) {
      setSelectedDoc({ ...selectedDoc, status: newStatus, notes: note })
      fetchData()
      toast.success(`Zmieniono status na: ${newStatus}`, { id: toastId })
    } else {
      toast.error('Błąd aktualizacji!', { id: toastId })
    }
    setIsUpdating(false)
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: any = {
      'Zatwierdzony': 'bg-green-100 text-green-700 border-green-200',
      'Oczekujący': 'bg-yellow-100 text-yellow-700 border-yellow-200',
      'Do poprawy': 'bg-red-100 text-red-700 border-red-200'
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold border ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
        {status}
      </span>
    )
  }

  const filteredDocs = docs.filter(doc => {
    const matchesSearch = (doc.title || '').toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterStatus === 'Wszystkie' || doc.status === filterStatus
    return matchesSearch && matchesFilter
  })

  // Zanim załadujemy stronę, musimy upewnić się, że w tabeli documents masz kolumnę owner_id (typu uuid)
  // Jeśli jej nie masz, aplikacja zwróci błąd, że kolumna nie istnieje. Zrobimy to w Supabase zaraz.

  return (
    <div className="flex min-h-screen bg-gray-50 relative overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 ml-64 p-8 transition-all">
        
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="text-blue-600" size={32} />
              Baza Dokumentów
            </h1>
            <p className="text-gray-500 mt-1">Repozytorium plików i pism AdminOS</p>
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all"
          >
            <Plus size={20} /> Nowy Dokument
          </button>
        </div>

        <div className="bg-white p-4 rounded-xl mb-6 border border-gray-100 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Szukaj dokumentu po nazwie..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900 bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select 
            className="border border-gray-200 rounded-lg px-4 py-2 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="Wszystkie">Wszystkie statusy</option>
            <option value="Oczekujący">Oczekujący</option>
            <option value="Zatwierdzony">Zatwierdzony</option>
            <option value="Do poprawy">Do poprawy</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase">Nazwa Dokumentu</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase">Właściciel (Owner)</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-gray-500 uppercase text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredDocs.length > 0 ? filteredDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-gray-800">{doc.title}</td>
                  <td className="px-6 py-4">
                    {/* Wyświetlamy imię właściciela pobrane przez relację z tabeli profiles! */}
                    {doc.profiles ? (
                        <span className="flex items-center gap-2 text-sm text-gray-700">
                            <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shrink-0">
                                {doc.profiles.full_name.charAt(0).toUpperCase()}
                            </div>
                            {doc.profiles.full_name}
                        </span>
                    ) : (
                        <span className="text-gray-400 italic text-sm">Brak (system)</span>
                    )}
                  </td>
                  <td className="px-6 py-4"><StatusBadge status={doc.status} /></td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => openDetails(doc)}
                      className="text-blue-600 hover:text-blue-800 font-bold text-sm transition-colors px-3 py-1 rounded-md hover:bg-blue-50"
                    >
                      Szczegóły
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic">
                    Brak wyników wyszukiwania.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODAL (DODAWANIE DOKUMENTU) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Dodaj nowy dokument</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-800 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddDocument} className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">Tytuł dokumentu</label>
                <input 
                  autoFocus
                  type="text" 
                  className="w-full px-4 py-3 text-gray-900 bg-white rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  placeholder="np. Raport kwartalny..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  required
                />
              </div>

              {/* Wybór Właściciela z bazy */}
              <div className="mb-8">
                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <User size={16}/> Przypisz właściciela (Owner)
                </label>
                <select 
                  className="w-full px-4 py-3 text-gray-900 bg-white rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  required
                >
                  {users.length === 0 && <option value="">Brak użytkowników w bazie</option>}
                  {users.map((user, index) => (
                <option key={user.email || index} value={user.id}>{user.full_name} ({user.role})</option>
                    ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Zgodnie ze standardem Komisji, każdy zasób musi mieć właściciela.</p>
              </div>
              
              <div className="flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
                  Anuluj
                </button>
                <button type="submit" disabled={isSubmitting || users.length === 0} className="flex-1 px-4 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:bg-blue-400">
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'Zapisz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- PANEL WERYFIKACJI POZOSTAJE BEZ ZMIAN --- */}
      {isDrawerOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}
      
      <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {selectedDoc && (
          <>
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Panel Weryfikacji</h2>
                <StatusBadge status={selectedDoc.status} />
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="text-gray-400 hover:text-gray-800 p-1 bg-white rounded-full shadow-sm">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-6">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Tytuł dokumentu</p>
                <p className="text-lg font-medium text-gray-900">{selectedDoc.title}</p>
              </div>
              
              <div className="mb-6">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Data wpływu</p>
                <p className="text-gray-900 flex items-center gap-2">
                  <Clock size={16} className="text-gray-400" />
                  {new Date(selectedDoc.created_at).toLocaleString('pl-PL')}
                </p>
              </div>

              <div className="mb-8">
                <label className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <MessageSquare size={16} /> Notatka weryfikatora
                </label>
                <textarea 
                  className="w-full p-3 border border-gray-200 rounded-xl text-gray-900 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 outline-none transition-all resize-none h-24"
                  placeholder="Dodaj powód odrzucenia lub uwagi do zatwierdzenia..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="border-t border-gray-100 pt-6">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Zapisz status z notatką</p>
                
                <div className="space-y-3">
                  <button onClick={() => updateStatusAndNote('Zatwierdzony')} disabled={isUpdating} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-green-50 text-green-700 hover:bg-green-100 font-bold rounded-xl transition-colors disabled:opacity-50 border border-green-200"><CheckCircle size={18} /> Zatwierdź</button>
                  <button onClick={() => updateStatusAndNote('Do poprawy')} disabled={isUpdating} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-xl transition-colors disabled:opacity-50 border border-red-200"><AlertTriangle size={18} /> Odrzuć / Do poprawy</button>
                  <button onClick={() => updateStatusAndNote('Oczekujący')} disabled={isUpdating} className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-yellow-50 text-yellow-700 hover:bg-yellow-100 font-bold rounded-xl transition-colors disabled:opacity-50 border border-yellow-200 mt-4"><Clock size={18} /> Oznacz jako Oczekujący</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}