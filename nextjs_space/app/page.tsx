
import { FileUpload } from '@/components/file-upload'
import { Languages, FileText, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container max-w-5xl mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              PO File Translator
            </span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Languages className="h-4 w-4" />
            <span>Magyar fordító</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-5xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <div className="mb-8">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent">
              Professzionális .po Fájl Fordító
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Fordítsd le .po lokalizációs fájljaidat gyorsan és pontosan magyar nyelvre 
              mesterséges intelligencia segítségével.
            </p>
          </div>

          {/* Features */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 shadow-sm border">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="font-semibold mb-2">Pontos Parseolás</h3>
              <p className="text-sm text-muted-foreground">
                Helyes .po fájl formátum feldolgozás, kommentek és speciális karakterek megőrzésével
              </p>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 shadow-sm border">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Languages className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-semibold mb-2">Többnyelvű Támogatás</h3>
              <p className="text-sm text-muted-foreground">
                Angol, német, francia és más nyelvekről magyar nyelvre fordítás
              </p>
            </div>

            <div className="bg-white/70 backdrop-blur-sm rounded-lg p-6 shadow-sm border">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="font-semibold mb-2">Gyors Feldolgozás</h3>
              <p className="text-sm text-muted-foreground">
                Valós idejű fordítási folyamat követés és azonnali letöltés
              </p>
            </div>
          </div>
        </section>

        {/* Upload Section */}
        <section className="max-w-2xl mx-auto">
          <FileUpload />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container max-w-5xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
            <div className="flex items-center space-x-2 mb-2 md:mb-0">
              <FileText className="h-4 w-4" />
              <span>PO File Translator © 2025.</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>Maximális fájlméret: 10MB</span>
              <span>Karakterlimit: 4000/bejegyzés</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
