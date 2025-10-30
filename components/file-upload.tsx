
'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, AlertTriangle, CheckCircle, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface UploadedProject {
  id: string;
  fileName: string;
  totalEntries: number;
  longEntries: number;
  sourceLang: string;
}

interface TranslationProgress {
  status: 'processing' | 'completed' | 'error';
  progress: number;
  current: number;
  total: number;
  message: string;
  projectId?: string;
}

export function FileUpload() {
  const [selectedLang, setSelectedLang] = useState('en')
  const [uploadedProject, setUploadedProject] = useState<UploadedProject | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    if (!file.name.endsWith('.po')) {
      toast.error('Csak .po fájlok engedélyezettek!')
      return
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast.error('A fájl túl nagy! Maximum 10MB engedélyezett.')
      return
    }

    setIsUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sourceLang', selectedLang)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Hiba a feltöltés során')
      }

      setUploadedProject(result.project)
      toast.success(`Fájl sikeresen feltöltve! ${result.project.totalEntries} bejegyzés található.`)

      if (result.project.longEntries > 0) {
        toast.warning(`${result.project.longEntries} bejegyzés túl hosszú (4000+ karakter) és kihagyásra kerül.`)
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hiba a feltöltés során')
    } finally {
      setIsUploading(false)
    }
  }, [selectedLang])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.po'],
      'application/octet-stream': ['.po']
    },
    multiple: false,
    disabled: isUploading || isTranslating
  })

  const startTranslation = async () => {
    if (!uploadedProject) return

    setIsTranslating(true)
    setTranslationProgress({
      status: 'processing',
      progress: 0,
      current: 0,
      total: uploadedProject.totalEntries,
      message: 'Fordítás indítása...'
    })

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: uploadedProject.id
        }),
      })

      if (!response.ok) {
        throw new Error('Hiba a fordítás indításakor')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader?.read() ?? { done: true, value: undefined }
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              return
            }
            try {
              const parsed = JSON.parse(data) as TranslationProgress
              setTranslationProgress(parsed)
              
              if (parsed.status === 'completed') {
                toast.success('Fordítás sikeresen befejezve!')
                return
              } else if (parsed.status === 'error') {
                throw new Error(parsed.message || 'Fordítási hiba')
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Hiba a fordítás során')
      setTranslationProgress({
        status: 'error',
        progress: 0,
        current: 0,
        total: uploadedProject.totalEntries,
        message: 'Fordítási hiba történt'
      })
    } finally {
      setIsTranslating(false)
    }
  }

  const downloadTranslatedFile = async () => {
    if (!uploadedProject?.id) return

    setIsDownloading(true)
    
    try {
      const response = await fetch(`/api/download/${uploadedProject.id}`)
      
      if (!response.ok) {
        throw new Error('Hiba a letöltés során')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = uploadedProject.fileName.replace('.po', '_hu.po')
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Fájl sikeresen letöltve!')
      
    } catch (error) {
      toast.error('Hiba a letöltés során')
    } finally {
      setIsDownloading(false)
    }
  }

  const resetUpload = () => {
    setUploadedProject(null)
    setTranslationProgress(null)
    setIsTranslating(false)
  }

  const isTranslationCompleted = translationProgress?.status === 'completed'

  return (
    <div className="space-y-6">
      {/* Language Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Forrásnyelv kiválasztása
          </CardTitle>
          <CardDescription>
            Válaszd ki a .po fájlban található szövegek eredeti nyelvét
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedLang} onValueChange={setSelectedLang} disabled={isUploading || isTranslating}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Válassz nyelvet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">🇺🇸 Angol</SelectItem>
              <SelectItem value="de">🇩🇪 Német</SelectItem>
              <SelectItem value="fr">🇫🇷 Francia</SelectItem>
              <SelectItem value="es">🇪🇸 Spanyol</SelectItem>
              <SelectItem value="it">🇮🇹 Olasz</SelectItem>
              <SelectItem value="pt">🇵🇹 Portugál</SelectItem>
              <SelectItem value="nl">🇳🇱 Holland</SelectItem>
              <SelectItem value="pl">🇵🇱 Lengyel</SelectItem>
              <SelectItem value="cs">🇨🇿 Cseh</SelectItem>
              <SelectItem value="sk">🇸🇰 Szlovák</SelectItem>
              <SelectItem value="auto">🌐 Automatikus felismerés</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            .po Fájl feltöltése
          </CardTitle>
          <CardDescription>
            Húzd ide a .po fájlt vagy kattints a tallózáshoz
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${(isUploading || isTranslating) ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary hover:bg-primary/5'}
            `}
          >
            <input {...getInputProps()} />
            <div className="mx-auto w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-4">
              {isUploading ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <Upload className="h-6 w-6" />
              )}
            </div>
            {isDragActive ? (
              <p>Engedd el a fájlt ide...</p>
            ) : (
              <div>
                <p className="font-medium mb-2">
                  {isUploading ? 'Feltöltés folyamatban...' : 'Kattints vagy húzd ide a .po fájlt'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Maximális fájlméret: 10MB
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Result */}
      {uploadedProject && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Fájl sikeresen feltöltve
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium">Fájlnév</p>
                <p className="text-sm text-muted-foreground">{uploadedProject.fileName}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Bejegyzések</p>
                <p className="text-sm text-muted-foreground">{uploadedProject.totalEntries}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Forrásnyelv</p>
                <Badge variant="secondary">
                  {selectedLang === 'en' ? 'Angol' : selectedLang === 'de' ? 'Német' : selectedLang}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium">Célnyelv</p>
                <Badge variant="default">Magyar</Badge>
              </div>
            </div>

            {uploadedProject.longEntries > 0 && (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  {uploadedProject.longEntries} bejegyzés túl hosszú (4000+ karakter) és kihagyásra kerül.
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                onClick={startTranslation} 
                disabled={isTranslating}
                className="flex-1"
              >
                {isTranslating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Fordítás folyamatban...
                  </>
                ) : (
                  'Fordítás indítása'
                )}
              </Button>
              <Button variant="outline" onClick={resetUpload} disabled={isTranslating}>
                Új fájl
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Translation Progress */}
      {translationProgress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {translationProgress.status === 'processing' && <Loader2 className="h-5 w-5 animate-spin" />}
              {translationProgress.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-600" />}
              {translationProgress.status === 'error' && <AlertTriangle className="h-5 w-5 text-red-600" />}
              Fordítás állapota
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>{translationProgress.message}</span>
                <span>{translationProgress.current}/{translationProgress.total}</span>
              </div>
              <Progress value={translationProgress.progress} className="h-2" />
            </div>

            {isTranslationCompleted && (
              <Button 
                onClick={downloadTranslatedFile}
                disabled={isDownloading}
                className="w-full"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Letöltés...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Lefordított fájl letöltése
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
