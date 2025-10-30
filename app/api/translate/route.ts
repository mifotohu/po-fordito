
import { NextRequest } from 'next/server';
import { PrismaClient } from '@prisma/client';

export const dynamic = "force-dynamic";

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const { projectId } = await request.json();

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Projekt ID szükséges' }), { status: 400 });
  }

  // Set up streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Get project and entries
        const project = await prisma.translationProject.findUnique({
          where: { id: projectId },
          include: { entries: true }
        });

        if (!project) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
            status: 'error', 
            message: 'Projekt nem található' 
          })}\n\n`));
          controller.close();
          return;
        }

        // Update project status
        await prisma.translationProject.update({
          where: { id: projectId },
          data: { status: 'translating' }
        });

        const entriesToTranslate = project.entries?.filter(entry => 
          entry.msgid && 
          entry.msgid.trim() !== '' && 
          !entry.hasError &&
          entry.characterCount <= 4000
        ) ?? [];

        let translatedCount = 0;
        const total = entriesToTranslate.length;

        // Send initial progress
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          status: 'processing',
          progress: 0,
          current: 0,
          total,
          message: 'Fordítás indítása...'
        })}\n\n`));

        // Process entries in batches
        const batchSize = 5;
        for (let i = 0; i < entriesToTranslate.length; i += batchSize) {
          const batch = entriesToTranslate.slice(i, i + batchSize);
          
          await Promise.all(batch.map(async (entry) => {
            try {
              const translation = await translateText(entry.msgid, project.sourceLang);
              
              await prisma.translationEntry.update({
                where: { id: entry.id },
                data: {
                  translatedMsgstr: translation,
                  isTranslated: true
                }
              });

              translatedCount++;
              
              // Send progress update
              const progress = Math.round((translatedCount / total) * 100);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                status: 'processing',
                progress,
                current: translatedCount,
                total,
                message: `Fordítás folyamatban... ${translatedCount}/${total}`
              })}\n\n`));

            } catch (error) {
              console.error(`Translation error for entry ${entry.id}:`, error);
              await prisma.translationEntry.update({
                where: { id: entry.id },
                data: {
                  hasError: true,
                  errorMessage: 'Fordítási hiba történt'
                }
              });
            }
          }));

          // Small delay to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Update project status
        await prisma.translationProject.update({
          where: { id: projectId },
          data: {
            status: 'completed',
            translatedEntries: translatedCount
          }
        });

        // Send completion message
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          status: 'completed',
          progress: 100,
          current: translatedCount,
          total,
          message: `Fordítás befejezve! ${translatedCount} bejegyzés lefordítva.`,
          projectId
        })}\n\n`));

      } catch (error) {
        console.error('Translation stream error:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          status: 'error',
          message: 'Hiba a fordítás során'
        })}\n\n`));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

async function translateText(text: string, sourceLang: string): Promise<string> {
  const messages = [
    {
      role: "system",
      content: `Te egy professzionális fordító vagy. A feladatod ${sourceLang === 'en' ? 'angol' : sourceLang === 'de' ? 'német' : sourceLang === 'fr' ? 'francia' : sourceLang} szövegek magyarra fordítása.

FONTOS SZABÁLYOK:
1. Tartsd meg az összes speciális karaktert és változót (pl. %s, %d, {variable}, {{placeholder}}, HTML tagek)
2. Használj helyes magyar ékezeteket (á, é, í, ó, ö, ő, ú, ü, ű)
3. Alkalmazz természetes magyar mondatszerkezetet
4. Ha a szöveg programozási vagy technikai kifejezéseket tartalmaz, őrizd meg azokat
5. Ha a szöveg HTML-t tartalmaz, ne módosítsd a tageket
6. Csak a szöveget fordítsd le, semmi mást ne adj hozzá`
    },
    {
      role: "user", 
      content: `Fordítsd le ezt a szöveget magyarra: "${text}"`
    }
  ];

  const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.3
    }),
  });

  if (!response.ok) {
    throw new Error('Translation API error');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || text;
}
